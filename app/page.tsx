import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketingHomepage } from "@/app/marketing/marketing-homepage";
import { getCurrentUser, hasTenantAccess, isPlatformAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "StockBase" };

function getSupportEmail() {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean) || "hello@stockbase.app";
}

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return <MarketingHomepage supportEmail={getSupportEmail()} />;
  }

  if (isPlatformAdmin(user)) {
    redirect("/platform/tenants");
  }

  if (!hasTenantAccess(user)) {
    redirect("/subscription");
  }

  redirect("/workspace");
}
