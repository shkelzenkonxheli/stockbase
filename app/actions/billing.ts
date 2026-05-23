"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/auth";
import {
  getBillingAppUrl,
  getStripePriceIdForPlan,
  type BillingPlanCode,
} from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

async function ensureStripeCustomer(input: {
  tenantId: number;
  tenantName: string;
  userEmail: string;
}) {
  const existingSubscription = await prisma.subscription.findUnique({
    where: { tenantId: input.tenantId },
    select: {
      providerCustomerId: true,
    },
  });

  const stripe = getStripeClient();

  if (existingSubscription?.providerCustomerId) {
    return existingSubscription.providerCustomerId;
  }

  const customer = await stripe.customers.create({
    email: input.userEmail,
    name: input.tenantName,
    metadata: {
      tenantId: String(input.tenantId),
      tenantName: input.tenantName,
    },
  });

  await prisma.subscription.update({
    where: { tenantId: input.tenantId },
    data: {
      providerCustomerId: customer.id,
    },
  });

  return customer.id;
}

export async function startCheckout(formData: FormData) {
  const currentUser = await getCurrentUser();
  const tenant = currentUser?.tenant;
  const planCode = formData.get("planCode")?.toString().trim() as BillingPlanCode | undefined;

  if (!currentUser || !tenant || !planCode) {
    redirect("/login");
  }

  const priceId = getStripePriceIdForPlan(planCode);
  if (!priceId) {
    redirect("/settings?error=billing-not-configured");
  }

  const customerId = await ensureStripeCustomer({
    tenantId: tenant.id,
    tenantName: tenant.businessName ?? tenant.name,
    userEmail: currentUser.email,
  });

  const stripe = getStripeClient();
  const appUrl = getBillingAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/settings?success=billing-return`,
    cancel_url: `${appUrl}/settings?error=billing-canceled`,
    metadata: {
      tenantId: String(tenant.id),
      planCode,
    },
    subscription_data: {
      metadata: {
        tenantId: String(tenant.id),
        planCode,
      },
    },
  });

  if (!session.url) {
    redirect("/settings?error=billing-session");
  }

  redirect(session.url);
}

export async function openBillingPortal() {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenant = currentUser.tenant;

  if (!tenant) {
    redirect("/login");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: tenant.id },
    select: {
      providerCustomerId: true,
    },
  });

  if (!subscription?.providerCustomerId) {
    redirect("/settings?error=billing-not-configured");
  }

  const stripe = getStripeClient();
  const appUrl = getBillingAppUrl();
  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.providerCustomerId,
    return_url: `${appUrl}/settings?success=portal-return`,
  });

  redirect(portal.url);
}
