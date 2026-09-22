import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isSocialMediaEnabled } from "@/lib/inventory-module-access";
import { createInstagramOAuthState, getInstagramConfig } from "@/lib/instagram-oauth";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !isSocialMediaEnabled(currentUser.tenant.catalogConfig)) {
    return NextResponse.redirect(new URL("/", process.env.INSTAGRAM_REDIRECT_URI ?? "http://localhost:3000"));
  }
  try {
    const config = getInstagramConfig();
    const state = createInstagramOAuthState({ tenantId: currentUser.tenant.id, userId: currentUser.id });
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", config.appId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish");
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/social?error=meta-config", process.env.INSTAGRAM_REDIRECT_URI ?? "http://localhost:3000"));
  }
}
