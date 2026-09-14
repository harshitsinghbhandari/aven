import type { GoogleTokens } from "./google-calendar";
import { decryptToken, encryptToken } from "./secure-token";

const COOKIE_NAME = "aven_google";
const MAX_AGE = 30 * 24 * 60 * 60;

export type GoogleSession = {
  tokens: GoogleTokens;
  selectedCalendarId: string;
};

function cookieValue(request: Request): string | undefined {
  return request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
}

export function readGoogleSession(request: Request): GoogleSession | null {
  const raw = cookieValue(request);
  if (!raw) return null;
  try {
    const decoded = decryptToken<GoogleSession | GoogleTokens>(decodeURIComponent(raw));
    if ("tokens" in decoded) return decoded;
    return { tokens: decoded, selectedCalendarId: "primary" };
  } catch {
    return null;
  }
}

export function googleSessionCookie(session: GoogleSession): string {
  return `${COOKIE_NAME}=${encryptToken(session)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearGoogleSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function jsonWithGoogleSession(data: unknown, session: GoogleSession, init?: ResponseInit): Response {
  const response = Response.json(data, init);
  response.headers.append("set-cookie", googleSessionCookie(session));
  return response;
}
