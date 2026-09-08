export type BillingPlanCode = "starter_monthly" | "pro_monthly";

export type BillingPlan = {
  code: BillingPlanCode;
  name: string;
  description: string;
  monthlyPriceLabel: string;
  stripePriceEnvKey: string;
  features: string[];
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    code: "starter_monthly",
    name: "Starter",
    description: "Per biznese te vogla qe duan inventar, porosi dhe raporte baze.",
    monthlyPriceLabel: "19 EUR / muaj",
    stripePriceEnvKey: "STRIPE_PRICE_STARTER_MONTHLY",
    features: [
      "Produkte, variante dhe stok baze",
      "Porosi normale dhe Quick Orders",
      "Import Excel/CSV dhe eksport baze",
      "1 depo aktive",
      "Raporte baze te inventarit",
    ],
  },
  {
    code: "pro_monthly",
    name: "Pro",
    description: "Per tenant-e me kategori te avancuara, role dhe flukse me te plota.",
    monthlyPriceLabel: "39 EUR / muaj",
    stripePriceEnvKey: "STRIPE_PRICE_PRO_MONTHLY",
    features: [
      "Gjithcka nga Starter",
      "Multi-warehouse dhe transfer stoku",
      "Inventory Count dhe barcode workflow",
      "Suppliers & Purchase Orders",
      "POS si add-on i aprovuar nga platforma",
    ],
  },
];

export function getBillingPlan(code?: string | null) {
  return BILLING_PLANS.find((plan) => plan.code === code) ?? null;
}

export function getBillingPlanLabel(code?: string | null) {
  const plan = getBillingPlan(code);
  if (plan) {
    return plan.name;
  }

  switch (code) {
    case "trial_manual":
      return "Trial";
    case "cash_manual":
    case "cash_manual_custom":
      return "Abonim manual";
    default:
      return "Pa plan";
  }
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
