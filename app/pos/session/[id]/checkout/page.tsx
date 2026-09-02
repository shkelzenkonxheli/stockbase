import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessPosSession, isPosEnabled } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { PosCheckout } from "./pos-checkout";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "POS Checkout",
};

export default async function PosCheckoutPage({ params }: RouteProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (!currentUser.tenant || !isPosEnabled(currentUser.tenant.catalogConfig)) {
    redirect("/");
  }

  const { id } = await params;
  const session = await canAccessPosSession(currentUser, Number(id));
  if (!session || session.status !== "OPEN") {
    notFound();
  }

  const [categories, productBrands] = await Promise.all([
    prisma.category.findMany({
      where: {
        tenantId: currentUser.tenant.id,
        isActive: true,
        products: {
          some: {
            variants: {
              some: {
                inventories: {
                  some: { warehouseId: session.warehouseId, stock: { gt: 0 } },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: {
        tenantId: currentUser.tenant.id,
        brand: { not: null },
        variants: {
          some: {
            inventories: {
              some: { warehouseId: session.warehouseId, stock: { gt: 0 } },
            },
          },
        },
      },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
      select: { brand: true },
    }),
  ]);

  return (
    <PosCheckout
      sessionId={session.id}
      registerName={session.register.name}
      warehouseName={session.register.warehouse.name}
      categories={categories}
      brands={productBrands.map((product) => product.brand?.trim() ?? "").filter(Boolean)}
    />
  );
}
