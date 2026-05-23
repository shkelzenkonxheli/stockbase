import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export function validatePasswordStrength(password: string) {
  if (password.length < 10) {
    return "Password duhet te kete te pakten 10 karaktere.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password duhet te kete te pakten nje shkronje te madhe.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password duhet te kete te pakten nje shkronje te vogel.";
  }

  if (!/\d/.test(password)) {
    return "Password duhet te kete te pakten nje numer.";
  }

  return null;
}

export function getPasswordPolicyHint() {
  return "Minimum 10 karaktere, nje shkronje te madhe, nje shkronje te vogel dhe nje numer.";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");

  if (derivedKey.length !== storedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKey);
}
