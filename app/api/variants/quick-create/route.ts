import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import {
  ProductImageUploadError,
  saveProductImage,
} from "@/lib/product-images";
import { prisma } from "@/lib/prisma";
import {
  buildBarcodeFromVariantId,
  buildVariantSku,
  ensureUniqueSku,
} from "@/lib/variant-codes";

type QuickCreatePayload = {
  productId?: number;
  color?: string;
  size?: string;
  stock?: number;
  price?: number;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN", "WAREHOUSE"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: QuickCreatePayload;
  let imageFile: File | null = null;

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      payload = {
        productId: Number(formData.get("productId")),
        color: formData.get("color")?.toString(),
        size: formData.get("size")?.toString(),
        stock: Number(formData.get("stock")),
        price:
          formData.get("price") !== null && formData.get("price") !== ""
            ? Number(formData.get("price"))
            : undefined,
      };
      const candidate = formData.get("image");
      imageFile = candidate instanceof File && candidate.size > 0 ? candidate : null;
    } else {
      payload = (await request.json()) as QuickCreatePayload;
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const productId = Number(payload.productId);
  const color = String(payload.color ?? "").trim();
  const size = String(payload.size ?? "").trim();
  const stock = Number(payload.stock);
  const price = Number(payload.price);

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !color ||
    !size ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    return NextResponse.json({ error: "Te dhenat nuk jane valide." }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      variants: {
        select: {
          id: true,
          size: true,
          color: true,
          imagePath: true,
          price: true,
          sku: true,
          barcode: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Produkti nuk u gjet." }, { status: 404 });
  }

  const duplicateVariant = product.variants.find(
    (variant) =>
      variant.size.trim().toLowerCase() === size.toLowerCase() &&
      variant.color.trim().toLowerCase() === color.toLowerCase(),
  );

  if (duplicateVariant) {
    return NextResponse.json(
      { error: `Varianti Nr ${size} / ${color} ekziston tashme.` },
      { status: 409 },
    );
  }

  const usedSkus = new Set(
    product.variants
      .map((variant) => variant.sku)
      .filter((sku): sku is string => Boolean(sku)),
  );
  const usedBarcodes = new Set(
    product.variants
      .map((variant) => variant.barcode)
      .filter((barcode): barcode is string => Boolean(barcode)),
  );

  const inheritedImage =
    product.variants.find(
      (variant) => variant.color.trim().toLowerCase() === color.toLowerCase() && variant.imagePath,
    )?.imagePath ?? null;
  const inheritedPrice =
    product.variants.find(
      (variant) => variant.color.trim().toLowerCase() === color.toLowerCase(),
    )?.price ?? null;
  const effectivePrice =
    inheritedPrice ?? (!Number.isNaN(price) && price >= 0 ? price : null);

  if (effectivePrice === null) {
    return NextResponse.json(
      { error: "Jep cmimin per ngjyre te re ose perdor nje ngjyre ekzistuese." },
      { status: 400 },
    );
  }

  let uploadedImagePath = inheritedImage;

  if (imageFile) {
    try {
      uploadedImagePath = await saveProductImage(productId, imageFile);
    } catch (error) {
      const message =
        error instanceof ProductImageUploadError
          ? error.message
          : "Ngarkimi i fotos deshtoi.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const baseSku = buildVariantSku({
    productName: product.name,
    size,
    color,
  });

  const createdVariant = await prisma.variant.create({
    data: {
      tenantId,
      productId,
      size,
      color,
      stock,
      price: effectivePrice,
      imagePath: uploadedImagePath,
      sku: ensureUniqueSku(baseSku, usedSkus),
    },
  });

  let barcode = buildBarcodeFromVariantId(createdVariant.id);
  if (usedBarcodes.has(barcode)) {
    barcode = `${barcode}${createdVariant.id}`;
  }

  await prisma.variant.update({
    where: { id: createdVariant.id },
    data: {
      barcode,
    },
  });

  if (stock > 0) {
    await prisma.stockMovement.create({
      data: {
        tenantId,
        variantId: createdVariant.id,
        quantity: stock,
        reason: "INCOMING_STOCK",
      },
    });
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);

  return NextResponse.json({
    ok: true,
    variant: {
      id: createdVariant.id,
      size,
      color,
      stock,
      price: effectivePrice,
      imagePath: uploadedImagePath,
    },
  });
}
