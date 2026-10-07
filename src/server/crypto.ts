import "server-only";
import { createHmac, randomInt, scrypt as scryptCb, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Guardian phone numbers are stored ONLY as HMAC-SHA256(pepper, E.164).
 *
 * Compliance note: Tanzania's mobile number space is ~10⁹ values, so an unpeppered SHA-256
 * could be reversed by brute force in minutes. The secret pepper (kept outside the database)
 * makes the stored value useless without the application secret. The raw number exists only in
 * memory while the SMS is being sent.
 */
export function hashPhone(e164: string): string {
  return createHmac("sha256", config.PHONE_HASH_PEPPER).update(e164).digest("hex");
}

/** Salted scrypt hash for PINs, OTPs and admin passwords: "scrypt$<salt>$<hash>". */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(secret, salt, 32, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(secret, Buffer.from(saltB64, "base64url"), expected.length, SCRYPT_PARAMS);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 6-digit numeric OTP from the OS CSPRNG. */
export function newOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function secureRandomInt(maxExclusive: number): number {
  return randomInt(0, maxExclusive);
}

/** Opaque, non-reversible identifier for rate-limit keys and audit (never store raw IPs). */
export function fingerprint(value: string): string {
  return createHmac("sha256", config.SESSION_SECRET).update(value).digest("base64url").slice(0, 22);
}
