import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuickOrdersForm } from "./quick-orders-form";

type QuickOrdersPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function createQuickOrders(formData: FormData) {
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
  const rowsRaw = formData.get("rows")?.toString();

  if (!source || !rowsRaw) {
    redirect("/orders/quick?error=validation");
  }

  let parsedRows: unknown;

  try {
    parsedRows = JSON.parse(rowsRaw);
  } catch {
    redirect("/orders/quick?error=validation");
  }

  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    redirect("/orders/quick?error=validation");
  }

  const rows = parsedRows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const candidate = row as {
        variantId?: unknown;
        quantity?: unknown;
      };

      const variantId = Number(candidate.variantId);
      const quantity = Number(candidate.quantity);

      if (!variantId || Number.isNaN(quantity) || quantity <= 0) {
        return null;
      }

      return {
        variantId,
        quantity,
      };
    })
    .filter(
      (
        row,
      ): row is {
        variantId: number;
        quantity: number;
      } => row !== null,
    );

  if (rows.length === 0) {
    redirect("/orders/quick?error=validation");
  }

  const requestedByVariant = new Map<number, number>();

  for (const row of rows) {
    requestedByVariant.set(
      row.variantId,
      (requestedByVariant.get(row.variantId) ?? 0) + row.quantity,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const variants = await tx.variant.findMany({
      where: {
        tenantId,
        id: {
          in: [...requestedByVariant.keys()],
        },
      },
      select: {
        id: true,
        stock: true,
        productId: true,
      },
    });

    if (variants.length !== requestedByVariant.size) {
      return { ok: false as const, reason: "variant" };
    }

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    for (const [variantId, quantity] of requestedByVariant.entries()) {
      const variant = variantsById.get(variantId);

      if (!variant || variant.stock < quantity) {
        return { ok: false as const, reason: "stock" };
      }
    }

    for (const row of rows) {
      await tx.order.create({
        data: {
          tenantId,
          customerName: "Quick Order",
          phone: "-",
          instagram: null,
          source,
          status: "DONE",
          quantity: row.quantity,
          variantId: row.variantId,
          items: {
            create: {
              variantId: row.variantId,
              quantity: row.quantity,
            },
          },
        },
      });
    }

    for (const [variantId, quantity] of requestedByVariant.entries()) {
      await tx.variant.update({
        where: { id: variantId },
        data: {
          stock: {
            decrement: quantity,
          },
        },
      });
    }

    return {
      ok: true as const,
      productIds: [...new Set(variants.map((variant) => variant.productId))],
    };
  });

  if (!result.ok) {
    redirect(`/orders/quick?error=${result.reason}`);
  }

  revalidatePath("/");
  revalidatePath("/products");
  for (const productId of result.productIds) {
    revalidatePath(`/products/${productId}`);
  }
  revalidatePath("/orders");
  revalidatePath("/orders/new");
  revalidatePath("/orders/quick");

  redirect("/orders");
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "stock":
      return "Nuk ka stok te mjaftueshem per nje ose me shume rreshta.";
    case "variant":
      return "Nje nga variantet nuk ekziston me.";
    case "validation":
      return "Ploteso variantin dhe nje sasi valide per cdo rresht qe don te ruash.";
    default:
      return null;
  }
}

export default async function QuickOrdersPage({
  searchParams,
}: QuickOrdersPageProps) {
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ecfccb_0%,transparent_20%),radial-gradient(circle_at_top_right,#dbeafe_0%,transparent_24%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-7xl rounded-[32px] border border-slate-200/80 bg-white/95 px-6 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Porosi te shpejta
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Porosi te shpejta
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Shiko porosite
            </Link>
            <Link
              href="/orders/new"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Porosi normale
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <FlashMessage
            type="error"
            text={errorMessage}
            className="mt-6 rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <QuickOrdersForm
          action={createQuickOrders}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            brand: product.category.name,
            imagePath: product.variants[0]?.imagePath ?? null,
          }))}
        />
      </section>
    </main>
  );
}
