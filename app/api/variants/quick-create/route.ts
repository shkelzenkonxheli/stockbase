import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentUser, hasRole } from "@/lib/auth";
import {
  ProductImageUploadError,
  saveProductImage,
} from "@/lib/product-images";
import { prisma } from "@/lib/prisma";
import {
  buildVariantIdentityKey,
  getCatalogAwareCategoryConfig,
  parseCategoryFieldConfig,
} from "@/lib/product-taxonomy";
import {
  buildBarcodeFromVariantId,
  buildVariantSku,
  ensureUniqueSku,
} from "@/lib/variant-codes";

type QuickCreatePayload = {
  productId?: number;
  warehouseId?: number;
  color?: string;
  size?: string;
  stock?: number;
  price?: number;
  material?: string;
  powerWatts?: string;
  locationCode?: string;
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
        warehouseId: Number(formData.get("warehouseId")),
        color: formData.get("color")?.toString(),
        size: formData.get("size")?.toString(),
        stock: Number(formData.get("stock")),
        price:
          formData.get("price") !== null && formData.get("price") !== ""
            ? Number(formData.get("price"))
            : undefined,
        material: formData.get("material")?.toString(),
        powerWatts: formData.get("powerWatts")?.toString(),
        locationCode: formData.get("locationCode")?.toString(),
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
  const warehouseId = Number(payload.warehouseId);
  const color = String(payload.color ?? "").trim();
  const size = String(payload.size ?? "").trim();
  const stock = Number(payload.stock);
  const price = Number(payload.price);
  const material = String(payload.material ?? "").trim() || null;
  const powerWatts = String(payload.powerWatts ?? "").trim() || null;
  const locationCode = String(payload.locationCode ?? "").trim() || null;

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(warehouseId) ||
    warehouseId <= 0 ||
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
          material: true,
          powerWatts: true,
          imagePath: true,
          price: true,
          sku: true,
          barcode: true,
        },
      },
      category: {
        select: {
          name: true,
          config: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Produkti nuk u gjet." }, { status: 404 });
  }

  const categoryConfig = getCatalogAwareCategoryConfig(
    currentUser.tenant?.catalogType,
    product.category?.name,
    currentUser.tenant?.catalogConfig,
    parseCategoryFieldConfig(product.category?.config),
  );

  const candidateKey = buildVariantIdentityKey(categoryConfig, {
    color,
    size,
    material,
    powerWatts,
  });

  const duplicateVariant = product.variants.find(
    (variant) =>
      buildVariantIdentityKey(categoryConfig, {
        color: variant.color,
        size: variant.size,
        material: variant.material,
        powerWatts: variant.powerWatts,
      }) === candidateKey,
  );

  if (duplicateVariant) {
    const duplicateLabel = [
      color,
      size,
      categoryConfig.showMaterialField ? material : null,
      categoryConfig.showPowerField ? powerWatts : null,
    ]
      .filter(Boolean)
      .join(" / ");

    return NextResponse.json(
      { error: `Varianti ${duplicateLabel} ekziston tashme.` },
      { status: 409 },
    );
  }

  const variantsInDb = await prisma.variant.findMany({
    where: { productId },
    select: {
      size: true,
      color: true,
      material: true,
      powerWatts: true,
      imagePath: true,
      price: true,
      sku: true,
      barcode: true,
    },
  });

  const duplicateInDb = variantsInDb.find(
    (variant) =>
      buildVariantIdentityKey(categoryConfig, {
        color: variant.color,
        size: variant.size,
        material: variant.material,
        powerWatts: variant.powerWatts,
      }) === candidateKey,
  );

  if (duplicateInDb) {
    const duplicateLabel = [
      color,
      size,
      categoryConfig.showMaterialField ? material : null,
      categoryConfig.showPowerField ? powerWatts : null,
    ]
      .filter(Boolean)
      .join(" / ");

    return NextResponse.json(
      { error: `Varianti ${duplicateLabel} ekziston tashme.` },
      { status: 409 },
    );
  }

  const usedSkus = new Set(
    variantsInDb
      .map((variant) => variant.sku)
      .filter((sku): sku is string => Boolean(sku)),
  );
  const usedBarcodes = new Set(
    variantsInDb
      .map((variant) => variant.barcode)
      .filter((barcode): barcode is string => Boolean(barcode)),
  );

  const inheritedImage =
    variantsInDb.find(
      (variant) => variant.color.trim().toLowerCase() === color.toLowerCase() && variant.imagePath,
    )?.imagePath ?? null;
  const inheritedPrice =
    variantsInDb.find(
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

  let createdVariant;

  try {
    createdVariant = await prisma.variant.create({
      data: {
        tenantId,
        productId,
        size,
        color,
        variantIdentityKey: candidateKey,
        stock,
        price: effectivePrice,
        imagePath: uploadedImagePath,
        material,
        powerWatts,
        locationCode,
        sku: ensureUniqueSku(baseSku, usedSkus),
        inventories: {
          create: {
            warehouseId,
            stock,
            locationCode,
          },
        },
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: `Varianti ${[color, size, material, powerWatts].filter(Boolean).join(" / ")} ekziston tashme.` },
        { status: 409 },
      );
    }

    throw error;
  }

  if (stock > 0) {
    await prisma.stockMovement.create({
      data: {
        tenantId,
        variantId: createdVariant.id,
        warehouseId,
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
      material,
      powerWatts,
      locationCode,
    },
  });
}
