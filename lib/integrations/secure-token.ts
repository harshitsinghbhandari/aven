import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): Buffer {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!value) throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY must be 32 bytes encoded as base64");
  return key;
}

export function encryptToken(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decryptToken<T>(value: string): T {
  const payload = Buffer.from(value, "base64url");
  if (payload.length < 29) throw new Error("Invalid encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", secret(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString()) as T;
}

export function signState(value: string): string {
  const signature = createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export function verifyState(signed: string): string | null {
  const separator = signed.lastIndexOf(".");
  if (separator < 1) return null;
  const value = signed.slice(0, separator);
  const expected = Buffer.from(createHmac("sha256", secret()).update(value).digest("base64url"));
  const received = Buffer.from(signed.slice(separator + 1));
  return expected.length === received.length && timingSafeEqual(expected, received) ? value : null;
}
