import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderForm } from "./order-form";

type NewOrderPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function createOrder(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN", "SELLER"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    redirect("/login");
  }

  const source = formData.get("source")?.toString() as
    | "INSTAGRAM"
    | "STORE"
    | "WHOLESALE"
    | undefined;
  const itemsRaw = formData.get("items")?.toString();
  const customerName = formData.get("customerName")?.toString().trim();
  const phone = formData.get("phone")?.toString().trim();
  const instagram = formData.get("instagram")?.toString().trim();
  const notes = formData.get("notes")?.toString().trim();

  if (!source || !itemsRaw || !customerName || !phone) {
    redirect("/orders/new?error=validation");
  }

  let parsedItems: unknown;

  try {
    parsedItems = JSON.parse(itemsRaw);
  } catch {
    redirect("/orders/new?error=validation");
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    redirect("/orders/new?error=validation");
  }

  const items = parsedItems
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as { variantId?: unknown; quantity?: unknown };
      const variantId = Number(candidate.variantId);
      const quantity = Number(candidate.quantity);

      if (!variantId || Number.isNaN(quantity) || quantity <= 0) {
        return null;
      }

      return { variantId, quantity };
    })
    .filter(
      (item): item is { variantId: number; quantity: number } => item !== null,
    );

  if (items.length === 0) {
    redirect("/orders/new?error=validation");
  }

  const result = await prisma.$transaction(async (tx) => {
    const variants = await tx.variant.findMany({
      where: {
        tenantId,
        id: {
          in: items.map((item) => item.variantId),
        },
      },
    });

    if (variants.length !== items.length) {
      return { ok: false as const, reason: "variant" };
    }

    const variantsById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    for (const item of items) {
      const variant = variantsById.get(item.variantId);

      if (!variant) {
        return { ok: false as const, reason: "variant" };
      }

      if (variant.stock < item.quantity) {
        return { ok: false as const, reason: "stock" };
      }
    }

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const primaryVariantId = items[0]?.variantId;

    const order = await tx.order.create({
      data: {
        tenantId,
        customerName,
        phone,
        instagram: instagram || null,
        source,
        notes: notes || null,
        status: "DONE",
        quantity: totalQuantity,
        variantId: primaryVariantId,
      },
    });

    await tx.orderItem.createMany({
      data: items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    });

    for (const item of items) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    return {
      ok: true as const,
      orderId: order.id,
      productIds: [...new Set(variants.map((variant) => variant.productId))],
    };
  });

  if (!result.ok) {
    redirect(`/orders/new?error=${result.reason}`);
  }

  revalidatePath("/");
  revalidatePath("/products");
  for (const productId of result.productIds) {
    revalidatePath(`/products/${productId}`);
  }
  revalidatePath("/orders");
  revalidatePath("/orders/new");

  redirect("/orders");
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "stock":
      return "Nuk ka stok te mjaftueshem per kete variant.";
    case "variant":
      return "Varianti i zgjedhur nuk ekziston me.";
    case "validation":
      return "Ploteso fushat kryesore para se te ruash porosine.";
    default:
      return null;
  }
}

export default async function NewOrderPage({
  searchParams,
}: NewOrderPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN", "SELLER"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);

  const products = await prisma.product.findMany({
    where: {
      tenantId,
      variants: {
        some: {
          stock: {
            gt: 0,
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      category: {
        select: {
          name: true,
        },
      },
      variants: {
        where: {
          imagePath: {
            not: null,
          },
        },
        select: {
          imagePath: true,
        },
        take: 1,
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Krijo Porosi te Re
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Zgjidh produktet dhe ploteso te dhenat e klientit.
            </p>
          </div>
        </section>

        {errorMessage ? (
          <FlashMessage
            type="error"
            text={errorMessage}
            className="rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <OrderForm
          action={createOrder}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            brand: product.category.name,
            imagePath: product.variants[0]?.imagePath ?? null,
          }))}
        />
      </div>
    </main>
  );
}
