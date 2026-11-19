import { createHash, timingSafeEqual } from "crypto";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyToken(token: string, storedHash: string) {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
