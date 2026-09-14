import type { GoogleTokens } from "./google-calendar";
import { getTeamGoogleSession, saveTeamGoogleSession } from "../db";
import { decryptToken, encryptToken } from "./secure-token";

const COOKIE_NAME = "aven_google";
const MAX_AGE = 30 * 24 * 60 * 60;

export type GoogleSession = {
  tokens: GoogleTokens;
  managedCalendarId: string;
};

export function encodeGoogleSession(session: GoogleSession): string {
  return encryptToken(session);
}

export function decodeGoogleSession(token: string): GoogleSession | null {
  try {
    const decoded = decryptToken<GoogleSession>(token);
    if (decoded.tokens && decoded.managedCalendarId && decoded.managedCalendarId !== "primary") return decoded;
    return null;
  } catch {
    return null;
  }
}

export async function loadTeamGoogleSession(teamId: string): Promise<GoogleSession | null> {
  const stored = await getTeamGoogleSession(teamId);
  return stored ? decodeGoogleSession(stored.encryptedSessionToken) : null;
}

export async function storeTeamGoogleSession(teamId: string, session: GoogleSession): Promise<void> {
  await saveTeamGoogleSession(teamId, encodeGoogleSession(session));
}

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
  return decodeGoogleSession(decodeURIComponent(raw));
}

export function googleSessionCookie(session: GoogleSession): string {
  return `${COOKIE_NAME}=${encodeGoogleSession(session)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearGoogleSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function jsonWithGoogleSession(data: unknown, session: GoogleSession, init?: ResponseInit): Response {
  const response = Response.json(data, init);
  response.headers.append("set-cookie", googleSessionCookie(session));
  return response;
}
