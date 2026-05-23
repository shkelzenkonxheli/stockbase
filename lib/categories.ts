import { prisma } from "@/lib/prisma";
import {
  getCatalogAllowedCategories,
  getCategoryConfig,
  type CatalogType,
  type ProductCategoryName,
} from "@/lib/product-taxonomy";

export async function ensureTenantCategories(
  tenantId: number,
  catalogType: CatalogType,
) {
  const categoryNames = getCatalogAllowedCategories(catalogType);

  await prisma.$transaction(
    categoryNames.map((name) =>
      prisma.category.upsert({
        where: {
          tenantId_name: {
            tenantId,
            name,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          tenantId,
          name,
          catalogType,
          isActive: true,
          config: getCategoryConfig(name),
        },
      }),
    ),
  );
}

export async function createTenantCategory(input: {
  tenantId: number;
  name: string;
  catalogType: CatalogType;
  presetCategoryName: ProductCategoryName;
  isActive?: boolean;
}) {
  return prisma.category.upsert({
    where: {
      tenantId_name: {
        tenantId: input.tenantId,
        name: input.name,
      },
    },
    update: {
      catalogType: input.catalogType,
      isActive: input.isActive ?? true,
      config: getCategoryConfig(input.presetCategoryName),
    },
    create: {
      tenantId: input.tenantId,
      name: input.name,
      catalogType: input.catalogType,
      isActive: input.isActive ?? true,
      config: getCategoryConfig(input.presetCategoryName),
    },
  });
}
