import { parseAssetPath, signAssetUrl } from "@/lib/asset-access";
import { prisma } from "@/lib/prisma";
import { getR2Config } from "@/lib/r2";

export async function resolveInstagramImageUrl(value: string, tenantId: number) {
  const baseUrl = process.env.SOCIAL_PUBLIC_BASE_URL?.trim();
  if (!baseUrl?.startsWith("https://")) {
    throw new Error("Per publikim nga localhost vendos SOCIAL_PUBLIC_BASE_URL me nje URL publike HTTPS.");
  }
  const base = new URL(baseUrl);
  const supplied = new URL(value, base);
  if (supplied.protocol !== "https:") throw new Error("Fotoja duhet te kete URL publike HTTPS.");
  if (!supplied.pathname.startsWith("/api/assets/")) {
    if (!/^https:\/\//i.test(value) || supplied.origin === base.origin) throw new Error("URL e fotos nuk eshte valide.");
    return supplied.toString();
  }

  const config = getR2Config();
  const asset = parseAssetPath(supplied.pathname, config.appFolder);
  if (!asset) throw new Error("Fotoja nuk eshte nje asset i vlefshem publik.");
  if (asset.kind === "social") {
    if (asset.ownerId !== tenantId) throw new Error("Fotoja nuk i perket biznesit aktiv.");
  } else {
    const variant = await prisma.variant.findFirst({
      where: { tenantId, productId: asset.ownerId, imagePath: asset.path },
      select: { id: true },
    });
    if (!variant) throw new Error("Fotoja nuk i perket biznesit aktiv.");
  }
  const url = new URL(asset.path, base);
  return signAssetUrl(url, asset, tenantId, config.secretAccessKey);
}
