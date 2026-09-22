import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isSocialMediaEnabled } from "@/lib/inventory-module-access";
import { encryptInstagramToken, getInstagramConfig, verifyInstagramOAuthState } from "@/lib/instagram-oauth";
import { prisma } from "@/lib/prisma";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";

type TokenResponse = { access_token?: string; error?: { message?: string } };
type InstagramProfileResponse = { user_id?: string; id?: string; username?: string; error?: { message?: string } };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = new URL(process.env.INSTAGRAM_REDIRECT_URI ?? "http://localhost:3000").origin;
  const currentUser = await getCurrentUser();
  const state = verifyInstagramOAuthState(url.searchParams.get("state") ?? "");
  const code = url.searchParams.get("code");

  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !isSocialMediaEnabled(currentUser.tenant.catalogConfig) || !state || state.tenantId !== currentUser.tenant.id || state.userId !== currentUser.id || !code) {
    return NextResponse.redirect(new URL("/social?error=instagram-authorize", baseUrl));
  }

  try {
    const config = getInstagramConfig();
    const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, grant_type: "authorization_code", redirect_uri: config.redirectUri, code }), cache: "no-store" });
    const tokenPayload = await tokenResponse.json() as TokenResponse;
    if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error(tokenPayload.error?.message ?? "Token exchange failed");

    const profileUrl = new URL("https://graph.instagram.com/me");
    profileUrl.searchParams.set("fields", "user_id,username");
    profileUrl.searchParams.set("access_token", tokenPayload.access_token);
    const profileResponse = await fetch(profileUrl, { cache: "no-store" });
    const instagram = await profileResponse.json() as InstagramProfileResponse;
    const instagramAccountId = instagram.user_id ?? instagram.id;
    if (!profileResponse.ok || !instagramAccountId) throw new Error("INSTAGRAM_PROFILE_NOT_FOUND");

    const existing = await prisma.tenantSettings.findUnique({ where: { tenantId: state.tenantId }, select: { catalogConfig: true } });
    const configValue = parseTenantCatalogConfig(existing?.catalogConfig);
    await prisma.tenantSettings.upsert({
      where: { tenantId: state.tenantId },
      create: { tenantId: state.tenantId, catalogConfig: { ...configValue, socialMedia: { enabled: true, instagram: { accountId: instagramAccountId, username: instagram.username ?? null, encryptedAccessToken: encryptInstagramToken(tokenPayload.access_token), connectedAt: new Date().toISOString() } } } },
      update: { catalogConfig: { ...configValue, socialMedia: { enabled: true, instagram: { accountId: instagramAccountId, username: instagram.username ?? null, encryptedAccessToken: encryptInstagramToken(tokenPayload.access_token), connectedAt: new Date().toISOString() } } } },
    });
    await prisma.auditLog.create({ data: { tenantId: state.tenantId, userId: currentUser.id, action: "SOCIAL_INSTAGRAM_CONNECTED", entityType: "SocialIntegration", entityLabel: instagram.username ?? instagram.id } });
    return NextResponse.redirect(new URL("/social?success=instagram-connected", baseUrl));
  } catch (error) {
    const message = error instanceof Error && error.message === "INSTAGRAM_PROFILE_NOT_FOUND" ? "instagram-profile" : "instagram-connect";
    return NextResponse.redirect(new URL(`/social?error=${message}`, baseUrl));
  }
}
