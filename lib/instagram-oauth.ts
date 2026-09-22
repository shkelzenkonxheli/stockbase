import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type OAuthState = { tenantId: number; userId: number; expiresAt: number };

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Mungon ${name} ne .env.`);
  return value;
}

export function getInstagramConfig() {
  return {
    appId: requiredEnv("INSTAGRAM_APP_ID"),
    appSecret: requiredEnv("INSTAGRAM_APP_SECRET"),
    redirectUri: requiredEnv("INSTAGRAM_REDIRECT_URI"),
  };
}

function encryptionKey() {
  return createHash("sha256").update(getInstagramConfig().appSecret).digest();
}

export function encryptInstagramToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptInstagramToken(value: string) {
  const [ivValue, authTagValue, encryptedValue] = value.split(".");
  if (!ivValue || !authTagValue || !encryptedValue) throw new Error("Instagram token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function createInstagramOAuthState(input: Omit<OAuthState, "expiresAt">) {
  const payload: OAuthState = { ...input, expiresAt: Date.now() + 10 * 60 * 1000 };
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getInstagramConfig().appSecret).update(raw).digest("base64url");
  return `${raw}.${signature}`;
}

export function verifyInstagramOAuthState(value: string): OAuthState | null {
  const [raw, signature] = value.split(".");
  if (!raw || !signature) return null;
  const expected = createHmac("sha256", getInstagramConfig().appSecret).update(raw).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const state = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthState;
    return Number.isInteger(state.tenantId) && Number.isInteger(state.userId) && state.expiresAt > Date.now() ? state : null;
  } catch { return null; }
}
