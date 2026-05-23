export type BillingPlanCode = "starter_monthly" | "pro_monthly";

export type BillingPlan = {
  code: BillingPlanCode;
  name: string;
  description: string;
  monthlyPriceLabel: string;
  stripePriceEnvKey: string;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    code: "starter_monthly",
    name: "Starter",
    description: "Per biznese te vogla qe duan inventar, porosi dhe raporte baze.",
    monthlyPriceLabel: "19 EUR / muaj",
    stripePriceEnvKey: "STRIPE_PRICE_STARTER_MONTHLY",
  },
  {
    code: "pro_monthly",
    name: "Pro",
    description: "Per tenant-e me kategori te avancuara, role dhe flukse me te plota.",
    monthlyPriceLabel: "39 EUR / muaj",
    stripePriceEnvKey: "STRIPE_PRICE_PRO_MONTHLY",
  },
];

export function getBillingPlan(code?: string | null) {
  return BILLING_PLANS.find((plan) => plan.code === code) ?? null;
}

export function getStripePriceIdForPlan(code: BillingPlanCode) {
  const plan = getBillingPlan(code);
  if (!plan) {
    return null;
  }

  return process.env[plan.stripePriceEnvKey] ?? null;
}

export function getBillingAppUrl() {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function isBillingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
