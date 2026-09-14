import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

export function isAuthorized(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${config.token()}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function isShortcutSetupAuthorized(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${config.shortcutSetupToken()}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export type CaptureIdentity = { teamId: string; userId: string };

function captureSignature(payload: string): Buffer {
  return createHmac("sha256", config.token()).update(`aven_capture_v1.${payload}`).digest();
}

export function createCaptureCredential(identity: CaptureIdentity): string {
  const payload = Buffer.from(JSON.stringify({ teamId: identity.teamId, userId: identity.userId })).toString("base64url");
  return `aven_capture_v1.${payload}.${captureSignature(payload).toString("base64url")}`;
}

export function readCaptureIdentity(request: Request): CaptureIdentity | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const [version, payload, encodedSignature, extra] = authorization.slice(7).split(".");
  if (version !== "aven_capture_v1" || !payload || !encodedSignature || extra) return null;
  try {
    const provided = Buffer.from(encodedSignature, "base64url");
    const expected = captureSignature(payload);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
    const identity = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<CaptureIdentity>;
    if (typeof identity.teamId !== "string" || typeof identity.userId !== "string") return null;
    return { teamId: identity.teamId, userId: identity.userId };
  } catch {
    return null;
  }
}
