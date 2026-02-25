import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [scheme, iterationsText, salt, expectedHex] = encoded.split("$");
  if (scheme !== "pbkdf2" || !iterationsText || !salt || !expectedHex) return false;
  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations)) return false;
  const actual = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}
