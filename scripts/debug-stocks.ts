import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      warehouseName: true,
      variants: {
        select: {
          id: true,
          size: true,
          color: true,
          stock: true,
          inventories: {
            select: {
              stock: true,
              warehouse: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  for (const product of products) {
    const productStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
    const inventoryStock = product.variants.reduce(
      (sum, variant) => sum + variant.inventories.reduce((invSum, inventory) => invSum + inventory.stock, 0),
      0,
    );

    console.log(JSON.stringify({
      productId: product.id,
      name: product.name,
      warehouseName: product.warehouseName,
      productStock,
      inventoryStock,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        size: variant.size,
        color: variant.color,
        stock: variant.stock,
        inventoryStock: variant.inventories.reduce((sum, inventory) => sum + inventory.stock, 0),
        inventories: variant.inventories.map((inventory) => `${inventory.warehouse.name}:${inventory.stock}`),
      })),
    }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
