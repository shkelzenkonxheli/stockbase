import { redirect } from "next/navigation";
import { requireRole, type AuthUser } from "@/lib/auth";
import { getPurchasesConfig, type TenantCatalogConfig } from "@/lib/product-taxonomy";

export function isPurchasesEnabled(config?: TenantCatalogConfig | null) {
  return getPurchasesConfig(config).enabled;
}

export async function requirePurchasesAccess() {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  if (!currentUser.tenant || !getPurchasesConfig(currentUser.tenant.catalogConfig).enabled) {
    redirect("/");
  }
  return currentUser;
}
