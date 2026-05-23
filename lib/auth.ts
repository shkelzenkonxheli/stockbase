import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseTenantCatalogConfig, type TenantCatalogConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { bootstrapLegacySingleTenant } from "@/lib/tenants";

const SESSION_COOKIE = "stock_app_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

export type UserRole = "SUPER_ADMIN" | "SELLER" | "WAREHOUSE";

export type AuthTenant = {
  id: number;
  name: string;
  slug: string;
  catalogType: "FOOTWEAR" | "ELECTRONICS" | "HOME_GOODS" | "DECOR";
  status: "ACTIVE" | "SUSPENDED" | "TRIALING" | "EXPIRED";
  businessName: string | null;
  primaryColor: string | null;
  currency: string;
  language: string;
  catalogConfig: TenantCatalogConfig | null;
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | null;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  accessBlockedReason: "SUSPENDED" | "TRIAL_EXPIRED" | "SUBSCRIPTION_INACTIVE" | null;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  tenant: AuthTenant | null;
};

function getPlatformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isPlatformAdminEmail(email: string) {
  const platformAdminEmails = getPlatformAdminEmails();

  if (platformAdminEmails.length === 0) {
    return false;
  }

  return platformAdminEmails.includes(email.trim().toLowerCase());
}

function getTenantAccessBlockedReason(input: {
  tenantStatus: AuthTenant["status"];
  subscriptionStatus: AuthTenant["subscriptionStatus"];
  trialEnd: Date | null;
}) {
  if (input.tenantStatus === "SUSPENDED") {
    return "SUSPENDED" as const;
  }

  if (input.tenantStatus === "EXPIRED") {
    return "TRIAL_EXPIRED" as const;
  }

  if (input.subscriptionStatus === "TRIALING") {
    if (input.trialEnd && input.trialEnd.getTime() < Date.now()) {
      return "TRIAL_EXPIRED" as const;
    }

    return null;
  }

  if (
    input.subscriptionStatus &&
    !["ACTIVE"].includes(input.subscriptionStatus)
  ) {
    return "SUBSCRIPTION_INACTIVE" as const;
  }

  return null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: {
      activeTenant: true,
      user: {
        include: {
          memberships: {
            include: {
              tenant: {
                include: {
                  settings: true,
                  subscription: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { token: sessionToken } }).catch(() => null);
    return null;
  }

  if (session.user.memberships.length === 0) {
    if (isPlatformAdminEmail(session.user.email)) {
      return {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        tenant: null,
      };
    }

    const tenantId = await bootstrapLegacySingleTenant({
      ownerUserId: session.user.id,
    });

    if (tenantId) {
      return getCurrentUser();
    }
  }

  let activeMembership =
    session.user.memberships.find(
      (membership) => membership.tenantId === session.activeTenantId,
    ) ?? session.user.memberships[0] ?? null;

  if (!session.activeTenantId && activeMembership) {
    await prisma.session.update({
      where: { token: sessionToken },
      data: {
        activeTenantId: activeMembership.tenantId,
      },
    }).catch(() => null);
  }

  if (activeMembership?.tenant.subscription?.status === "TRIALING") {
    const trialEnd = activeMembership.tenant.subscription.trialEnd;

    if (trialEnd && trialEnd.getTime() < Date.now()) {
      await prisma.$transaction([
        prisma.subscription.updateMany({
          where: {
            tenantId: activeMembership.tenantId,
            status: "TRIALING",
          },
          data: {
            status: "EXPIRED",
          },
        }),
        prisma.tenant.updateMany({
          where: {
            id: activeMembership.tenantId,
            status: "TRIALING",
          },
          data: {
            status: "EXPIRED",
          },
        }),
      ]).catch(() => null);

      activeMembership = {
        ...activeMembership,
        tenant: {
          ...activeMembership.tenant,
          status: "EXPIRED",
          subscription: activeMembership.tenant.subscription
            ? {
                ...activeMembership.tenant.subscription,
                status: "EXPIRED",
              }
            : null,
        },
      };
    }
  }

  const accessBlockedReason = activeMembership
    ? getTenantAccessBlockedReason({
        tenantStatus: activeMembership.tenant.status,
        subscriptionStatus: activeMembership.tenant.subscription?.status ?? null,
        trialEnd: activeMembership.tenant.subscription?.trialEnd ?? null,
      })
    : null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: activeMembership?.role ?? session.user.role,
    tenant: activeMembership
        ? {
          id: activeMembership.tenant.id,
          name: activeMembership.tenant.name,
          slug: activeMembership.tenant.slug,
          catalogType: activeMembership.tenant.catalogType,
          status: activeMembership.tenant.status,
          businessName: activeMembership.tenant.settings?.businessName ?? null,
          primaryColor: activeMembership.tenant.settings?.primaryColor ?? null,
          currency: activeMembership.tenant.settings?.currency ?? "EUR",
          language: activeMembership.tenant.settings?.language ?? "sq",
          catalogConfig: parseTenantCatalogConfig(
            activeMembership.tenant.settings?.catalogConfig,
          ),
          subscriptionStatus: activeMembership.tenant.subscription?.status ?? null,
          trialEnd: activeMembership.tenant.subscription?.trialEnd ?? null,
          currentPeriodEnd: activeMembership.tenant.subscription?.currentPeriodEnd ?? null,
          accessBlockedReason,
        }
      : null,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.tenant?.accessBlockedReason) {
    redirect("/subscription");
  }

  return user;
}

export async function requireRole(
  roles: UserRole[],
) {
  const user = await requireUser();

  if (!user.tenant) {
    redirect(isPlatformAdmin(user) ? "/platform/tenants" : "/login");
  }

  if (!roles.includes(user.role)) {
    redirect("/");
  }

  return user;
}

export function hasRole(user: AuthUser, roles: UserRole[]) {
  return roles.includes(user.role);
}

export async function createSession(userId: number, activeTenantId?: number | null) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      token,
      userId,
      activeTenantId: activeTenantId ?? null,
      expiresAt,
    },
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    await prisma.session.delete({ where: { token: sessionToken } }).catch(() => null);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function requireTenant() {
  const user = await requireUser();

  if (!user.tenant) {
    redirect("/login");
  }

  return user.tenant;
}

export function hasTenantAccess(user: AuthUser) {
  return !user.tenant?.accessBlockedReason;
}

export function isPlatformAdmin(user: AuthUser | null) {
  if (!user) {
    return false;
  }

  return isPlatformAdminEmail(user.email);
}

export async function requirePlatformAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isPlatformAdmin(user)) {
    redirect("/");
  }

  return user;
}
