import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiProductAssistantConfig } from "@/lib/product-taxonomy";

export const runtime = "nodejs";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    brand: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    color: { type: ["string", "null"] },
    material: { type: ["string", "null"] },
    attributes: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["brand", "model", "category", "color", "material", "attributes", "confidence"],
} as const;

type ProductAnalysis = {
  brand: string | null;
  model: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  attributes: string[];
  confidence: number;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function findExistingProducts(tenantId: number, analysis: ProductAnalysis) {
  const model = analysis.model?.trim();
  const brand = analysis.brand?.trim();
  if (!model && !brand) return [];

  const products = await prisma.product.findMany({
    where: {
      tenantId,
      OR: [
        ...(model ? [{ name: { contains: model, mode: "insensitive" as const } }] : []),
        ...(brand ? [{ brand: { contains: brand, mode: "insensitive" as const } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      brand: true,
      category: { select: { name: true } },
      variants: {
        where: { imagePath: { not: null } },
        orderBy: { id: "asc" },
        select: { color: true, imagePath: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  const normalizedModel = normalize(model);
  const normalizedBrand = normalize(brand);
  const normalizedCategory = normalize(analysis.category);
  const normalizedColor = normalize(analysis.color);

  return products.map((product) => {
    const variant = product.variants[0];
    const modelMatch = Boolean(normalizedModel && normalize(product.name).includes(normalizedModel));
    const brandMatch = Boolean(normalizedBrand && normalize(product.brand).includes(normalizedBrand));
    const categoryMatch = Boolean(normalizedCategory && normalize(product.category.name) === normalizedCategory);
    const colorMatch = Boolean(normalizedColor && variant && normalize(variant.color) === normalizedColor);
    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category.name,
      color: variant?.color ?? null,
      imagePath: variant?.imagePath ?? null,
      matchedOn: [modelMatch ? "model" : null, brandMatch ? "brand" : null, categoryMatch ? "category" : null, colorMatch ? "color" : null].filter((value): value is string => Boolean(value)),
      score: (modelMatch ? 50 : 0) + (brandMatch ? 20 : 0) + (categoryMatch ? 10 : 0) + (colorMatch ? 5 : 0),
    };
  }).filter((product) => product.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    color: product.color,
    imagePath: product.imagePath,
    matchedOn: product.matchedOn,
  }));
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !getAiProductAssistantConfig(currentUser.tenant.catalogConfig).enabled) {
    return NextResponse.json({ error: "Nuk ke qasje." }, { status: 403 });
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY mungon ne konfigurim." }, { status: 503 });

  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/") || image.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Ngarko nje foto JPG, PNG ose WebP deri ne 8 MB." }, { status: 400 });
  }

  const dataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.AI_PRODUCT_MODEL?.trim() || "gpt-5-mini",
      input: [{ role: "user", content: [
        { type: "input_text", text: "Analizo vetem produktin ne foto. Lexo emrin ose logon e brandit kur dallohet qarte. Jep modelin e sakte vetem nese lexohet ne foto; mos e hamendeso nga pamja ose nga brandi. Jep null per brandin ose modelin kur nuk je i sigurt. Ngjyra te jete e shkurter (nje ose dy ngjyra kryesore, p.sh. Brown/Cream), jo pershkrim i detajeve ose i sholles. Per patika, kepuce dhe sandale kthe material null dhe attributes []. Mos hamendeso numrin, sasine, koston ose cmimin." },
        { type: "input_image", image_url: dataUrl, detail: "auto" },
      ] }],
      text: { format: { type: "json_schema", name: "product_analysis", strict: true, schema } },
    });
    const analysis = JSON.parse(response.output_text) as ProductAnalysis;
    try {
      const existingProducts = await findExistingProducts(currentUser.tenant.id, analysis);
      return NextResponse.json({ analysis, existingProducts });
    } catch (error) {
      console.error("AI product match lookup failed", { tenantId: currentUser.tenant.id, message: error instanceof Error ? error.message : "Unknown error" });
      return NextResponse.json({ analysis, existingProducts: [], matchCheckFailed: true });
    }
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    console.error("AI product analysis failed", { code });
    if (code === "credit_balance_exhausted") {
      return NextResponse.json({ error: "Nuk ka kredi ne OpenAI API. Shto kredi te Billing dhe provo perseri." }, { status: 402 });
    }
    return NextResponse.json({ error: "Analiza e fotos deshtoi. Provo perseri." }, { status: 502 });
  }
}
