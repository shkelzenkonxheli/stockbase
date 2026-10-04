import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MAX_PUBLIC_IMAGE_BYTES, parseAssetPath, PUBLIC_IMAGE_TYPES, verifyAssetSignature, type AssetKey } from "@/lib/asset-access";
import { prisma } from "@/lib/prisma";
import { getR2Client, getR2Config } from "@/lib/r2";

type AssetRouteProps = { params: Promise<{ key?: string[] }> };

async function sessionOwnsTenant(tenantId: number) {
  const token = (await cookies()).get("stock_app_session")?.value;
  if (!token) return false;
  const session = await prisma.session.findFirst({
    where: { token, expiresAt: { gt: new Date() }, activeTenantId: tenantId, user: { memberships: { some: { tenantId } } } },
    select: { id: true },
  });
  return Boolean(session);
}

async function authorizeAsset(requestUrl: URL, asset: AssetKey, secret: string) {
  if (asset.kind === "logo") {
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: asset.ownerId }, select: { logoUrl: true } });
    return { allowed: settings?.logoUrl === asset.path && await sessionOwnsTenant(asset.ownerId), cache: "private, no-store" };
  }
  if (asset.kind === "social") {
    const signed = verifyAssetSignature(requestUrl, asset, asset.ownerId, secret);
    return signed ? { allowed: true, cache: "private, no-store" } : {
      allowed: await sessionOwnsTenant(asset.ownerId), cache: "private, no-store",
    };
  }

  const variant = await prisma.variant.findFirst({
    where: { productId: asset.ownerId, imagePath: asset.path },
    select: {
      product: {
        select: {
          tenantId: true,
          catalogProducts: {
            where: { catalog: { isPublic: true, status: "ACTIVE" } },
            select: { catalog: { select: { tenantId: true } } },
          },
        },
      },
    },
  });
  const tenantId = variant?.product.tenantId;
  if (!tenantId) return { allowed: false, cache: "private, no-store" };
  const published = variant.product.catalogProducts.some((item) => item.catalog.tenantId === tenantId);
  if (published) return { allowed: true, cache: "public, max-age=60" };
  const signed = verifyAssetSignature(requestUrl, asset, tenantId, secret);
  return signed ? { allowed: true, cache: "private, no-store" } : {
    allowed: await sessionOwnsTenant(tenantId), cache: "private, no-store",
  };
}

function imageHeaders(contentType: string | undefined, contentLength: number | undefined, cache: string) {
  const type = contentType?.toLowerCase() ?? "";
  const length = contentLength ?? 0;
  if (!PUBLIC_IMAGE_TYPES.has(type) || length <= 0 || length > MAX_PUBLIC_IMAGE_BYTES) return null;
  return {
    "Content-Type": type,
    "Content-Length": String(length),
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
}

async function serveAsset(request: Request, { params }: AssetRouteProps, head: boolean) {
  const { key = [] } = await params;
  const requestUrl = new URL(request.url);
  try {
    const config = getR2Config();
    const asset = parseAssetPath(`/api/assets/${key.join("/")}`, config.appFolder);
    if (!asset) return NextResponse.json({ error: "Fotoja nuk u gjet." }, { status: 404 });
    const access = await authorizeAsset(requestUrl, asset, config.secretAccessKey);
    if (!access.allowed) return NextResponse.json({ error: "Fotoja nuk u gjet." }, { status: 404 });

    const client = getR2Client();
    if (head) {
      const metadata = await client.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: asset.key }));
      const headers = imageHeaders(metadata.ContentType, metadata.ContentLength, access.cache);
      return headers ? new Response(null, { headers }) : NextResponse.json({ error: "Fotoja nuk mund te shfaqet." }, { status: 415 });
    }

    const result = await client.send(new GetObjectCommand({ Bucket: config.bucketName, Key: asset.key }));
    const headers = imageHeaders(result.ContentType, result.ContentLength, access.cache);
    if (!headers) {
      if (result.Body) await result.Body.transformToWebStream().cancel();
      return NextResponse.json({ error: "Fotoja nuk mund te shfaqet." }, { status: 415 });
    }
    if (!result.Body) return NextResponse.json({ error: "Fotoja nuk u gjet." }, { status: 404 });
    return new Response(result.Body.transformToWebStream(), { headers });
  } catch (error) {
    const name = error instanceof Error ? error.name.toLowerCase() : "";
    if (name.includes("nosuchkey") || name.includes("notfound")) {
      return NextResponse.json({ error: "Fotoja nuk u gjet." }, { status: 404 });
    }
    console.error("Asset delivery failed", { name });
    return NextResponse.json({ error: "Leximi i fotos nga R2 deshtoi." }, { status: 500 });
  }
}

export async function GET(request: Request, props: AssetRouteProps) {
  return serveAsset(request, props, false);
}

export async function HEAD(request: Request, props: AssetRouteProps) {
  return serveAsset(request, props, true);
}
