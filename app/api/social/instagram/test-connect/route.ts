import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isSocialMediaEnabled } from "@/lib/inventory-module-access";
import { encryptInstagramToken } from "@/lib/instagram-oauth";
import { prisma } from "@/lib/prisma";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";

type InstagramProfile = { user_id?: string; id?: string; username?: string; error?: { message?: string; code?: number } };

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const baseUrl = new URL(request.url).origin;
  const token = process.env.INSTAGRAM_TEST_ACCESS_TOKEN?.trim();

  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !isSocialMediaEnabled(currentUser.tenant.catalogConfig) || !token) {
    return NextResponse.redirect(new URL("/social?error=instagram-test-token", baseUrl));
  }

  try {
    const profileUrl = new URL("https://graph.instagram.com/me");
    profileUrl.searchParams.set("fields", "user_id,username");
    profileUrl.searchParams.set("access_token", token);
    const response = await fetch(profileUrl, { cache: "no-store" });
    const profile = await response.json() as InstagramProfile;
    const accountId = profile.user_id ?? profile.id;
    if (!response.ok || !accountId) {
      console.error("Instagram test token verification failed", {
        status: response.status,
        message: profile.error?.message ?? "Instagram account was not returned",
        code: profile.error?.code,
      });
      throw new Error("Invalid Instagram test token");
    }

    const existing = await prisma.tenantSettings.findUnique({ where: { tenantId: currentUser.tenant.id }, select: { catalogConfig: true } });
    const config = parseTenantCatalogConfig(existing?.catalogConfig);
    const instagram = { accountId, username: profile.username ?? null, encryptedAccessToken: encryptInstagramToken(token), connectedAt: new Date().toISOString() };
    await prisma.tenantSettings.upsert({
      where: { tenantId: currentUser.tenant.id },
      create: { tenantId: currentUser.tenant.id, catalogConfig: { ...config, socialMedia: { enabled: true, instagram } } },
      update: { catalogConfig: { ...config, socialMedia: { enabled: true, instagram } } },
    });
    await prisma.auditLog.create({ data: { tenantId: currentUser.tenant.id, userId: currentUser.id, action: "SOCIAL_INSTAGRAM_TEST_CONNECTED", entityType: "SocialIntegration", entityLabel: profile.username ?? accountId } });
    return NextResponse.redirect(new URL("/social?success=instagram-connected", baseUrl));
  } catch (error) {
    console.error("Instagram test connection failed", {
      tenantId: currentUser.tenant.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.redirect(new URL("/social?error=instagram-test-token", baseUrl));
  }
}
