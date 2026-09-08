import { redirect } from "next/navigation";
import { requireRole, type UserRole } from "@/lib/auth";
import {
  getBarcodeConfig,
  getInventoryCountConfig,
  getMultiWarehouseConfig,
  type TenantCatalogConfig,
} from "@/lib/product-taxonomy";

export function isBarcodeEnabled(config?: TenantCatalogConfig | null) {
  return getBarcodeConfig(config).enabled;
}

export function isInventoryCountEnabled(config?: TenantCatalogConfig | null) {
  return getInventoryCountConfig(config).enabled;
}

export function isMultiWarehouseEnabled(config?: TenantCatalogConfig | null) {
  return getMultiWarehouseConfig(config).enabled;
}

export async function requireBarcodeAccess(
  roles: UserRole[] = ["SUPER_ADMIN", "SELLER", "WAREHOUSE"],
) {
  const currentUser = await requireRole(roles);
  if (!currentUser.tenant || !isBarcodeEnabled(currentUser.tenant.catalogConfig)) {
    redirect("/");
  }
  return currentUser;
}

export async function requireInventoryCountAccess() {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  if (!currentUser.tenant || !isInventoryCountEnabled(currentUser.tenant.catalogConfig)) {
    redirect("/");
  }
  return currentUser;
}

export async function requireMultiWarehouseAccess() {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  if (!currentUser.tenant || !isMultiWarehouseEnabled(currentUser.tenant.catalogConfig)) {
    redirect("/");
  }
  return currentUser;
}
