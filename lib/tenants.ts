import { prisma } from "@/lib/prisma";
import { ensureTenantCategories } from "@/lib/categories";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import type { CatalogType } from "@/lib/product-taxonomy";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createUniqueTenantSlug(name: string) {
  const baseSlug = slugify(name) || "tenant";
  let candidate = baseSlug;
  let suffix = 2;

  while (await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function getTrialEndDate(days = 14) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function createTenantWorkspace(input: {
  ownerName: string;
  ownerEmail: string;
  password: string;
  businessName: string;
  catalogType: CatalogType;
}) {
  const ownerName = input.ownerName.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const businessName = input.businessName.trim();

  if (!ownerName || !ownerEmail || !businessName || !input.password) {
    throw new Error("VALIDATION_ERROR");
  }

  const passwordValidationError = validatePasswordStrength(input.password);
  if (passwordValidationError) {
    throw new Error("WEAK_PASSWORD");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("EMAIL_EXISTS");
  }

  const passwordHash = await hashPassword(input.password);
  const tenantSlug = await createUniqueTenantSlug(businessName);
  const trialStart = new Date();
  const trialEnd = getTrialEndDate();

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: businessName,
        slug: tenantSlug,
        status: "TRIALING",
        catalogType: input.catalogType,
        settings: {
          create: {
            businessName,
          },
        },
        subscription: {
          create: {
            planCode: "trial_manual",
            status: "TRIALING",
            trialStart,
            trialEnd,
          },
        },
      },
    });

    const user = await tx.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        passwordHash,
        role: "SUPER_ADMIN",
        memberships: {
          create: {
            tenantId: tenant.id,
            role: "SUPER_ADMIN",
          },
        },
      },
    });

    return { tenant, user };
  });

  await ensureTenantCategories(result.tenant.id, input.catalogType);

  return result;
}

export async function bootstrapLegacySingleTenant(options: {
  ownerUserId: number;
  businessName?: string | null;
}) {
  const existingTenant = await prisma.tenant.findFirst({
    select: { id: true },
  });

  if (existingTenant) {
    return existingTenant.id;
  }

  const owner = await prisma.user.findUnique({
    where: { id: options.ownerUserId },
    select: { id: true, name: true, role: true },
  });

  if (!owner) {
    return null;
  }

  const tenantName =
    options.businessName?.trim() ||
    `${owner.name.trim() || "Biznesi im"} Workspace`;
  const tenantSlug = await createUniqueTenantSlug(tenantName);

  const tenant = await prisma.$transaction(async (tx) => {
    const createdTenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        status: "ACTIVE",
        catalogType: "ELECTRONICS",
        settings: {
          create: {
            businessName: tenantName,
          },
        },
        subscription: {
          create: {
            status: "ACTIVE",
            currentPeriodStart: new Date(),
          },
        },
      },
      select: { id: true },
    });

    const users = await tx.user.findMany({
      select: { id: true, role: true },
    });

    if (users.length > 0) {
      await tx.tenantMembership.createMany({
        data: users.map((user) => ({
          tenantId: createdTenant.id,
          userId: user.id,
          role: user.role,
        })),
      });
    }

    await Promise.all([
      tx.product.updateMany({
        where: { tenantId: null },
        data: { tenantId: createdTenant.id },
      }),
      tx.variant.updateMany({
        where: { tenantId: null },
        data: { tenantId: createdTenant.id },
      }),
      tx.order.updateMany({
        where: { tenantId: null },
        data: { tenantId: createdTenant.id },
      }),
      tx.stockMovement.updateMany({
        where: { tenantId: null },
        data: { tenantId: createdTenant.id },
      }),
      tx.session.updateMany({
        where: { activeTenantId: null },
        data: { activeTenantId: createdTenant.id },
      }),
    ]);

    return createdTenant;
  });

  return tenant.id;
}
