import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getR2Client, getR2Config } from "@/lib/r2";

type AssetRouteProps = {
  params: Promise<{
    key?: string[];
  }>;
};

export async function GET(_: Request, { params }: AssetRouteProps) {
  const { key = [] } = await params;
  const objectKey = key.map((segment) => decodeURIComponent(segment)).join("/");

  if (!objectKey) {
    return NextResponse.json({ error: "Asset key mungon." }, { status: 400 });
  }

  try {
    const config = getR2Config();
    const client = getR2Client();
    const result = await client.send(
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
      }),
    );

    if (!result.Body) {
      return NextResponse.json({ error: "Fajlli nuk u gjet." }, { status: 404 });
    }

    const body = Buffer.from(await result.Body.transformToByteArray());

    return new Response(body, {
      headers: {
        "Content-Type": result.ContentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.toLowerCase().includes("nosuchkey")) {
      return NextResponse.json({ error: "Fajlli nuk u gjet." }, { status: 404 });
    }

    return NextResponse.json({ error: "Leximi i fotos nga R2 deshtoi." }, { status: 500 });
  }
}
