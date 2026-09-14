const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type GoogleTokens = {
  access_token: string;
  expires_at: number;
  refresh_token?: string;
};

export type GoogleCalendar = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
};

export function isWritableCalendar(calendar: GoogleCalendar): boolean {
  return calendar.accessRole === "owner" || calendar.accessRole === "writer";
}

export async function listWritableCalendars(tokens: GoogleTokens) {
  const query = new URLSearchParams({ minAccessRole: "writer", showHidden: "false", maxResults: "250" });
  const result = await calendarRequest(tokens, `/users/me/calendarList?${query}`);
  const calendars = ((result.data as { items?: GoogleCalendar[] }).items ?? []).filter(isWritableCalendar);
  return { calendars, tokens: result.tokens };
}

function settings() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_URL are required");
  }
  return { clientId, clientSecret, redirectUri: `${appUrl.replace(/\/$/, "")}/api/integrations/google/callback` };
}

export function authorizationUrl(state: string): string {
  const { clientId, redirectUri } = settings();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

async function tokenRequest(params: URLSearchParams): Promise<GoogleTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Google OAuth failed: ${String(body.error_description ?? body.error)}`);
  return {
    access_token: String(body.access_token),
    refresh_token: body.refresh_token ? String(body.refresh_token) : undefined,
    expires_at: Date.now() + Number(body.expires_in ?? 3600) * 1000,
  };
}

export function exchangeCode(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = settings();
  return tokenRequest(new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }));
}

export async function refreshTokens(tokens: GoogleTokens): Promise<GoogleTokens> {
  if (tokens.expires_at > Date.now() + 60_000) return tokens;
  if (!tokens.refresh_token) throw new Error("Google Calendar authorization has expired");
  const { clientId, clientSecret } = settings();
  const refreshed = await tokenRequest(new URLSearchParams({
    refresh_token: tokens.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  }));
  return { ...refreshed, refresh_token: refreshed.refresh_token ?? tokens.refresh_token };
}

export async function calendarRequest(tokens: GoogleTokens, path: string, init?: RequestInit) {
  const current = await refreshTokens(tokens);
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${current.access_token}`, ...init?.headers },
  });
  if (!response.ok) throw new Error(`Google Calendar API failed with ${response.status}: ${await response.text()}`);
  return { data: await response.json(), tokens: current };
}
