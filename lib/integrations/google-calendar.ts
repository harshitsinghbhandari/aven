const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
export const AVEN_CALENDAR_NAME = "Aven";
const AVEN_CALENDAR_DESCRIPTION = "Created and maintained by Aven";

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

export type ManagedCalendarAction =
  | { action: "create"; title: string; startsAt: string; endsAt?: string | null; description?: string; sourceUpdateIds?: string[] }
  | { action: "update"; eventId: string; title?: string; startsAt?: string; endsAt?: string | null; description?: string; sourceUpdateIds?: string[] }
  | { action: "delete"; eventId: string };

export type ManagedCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  status?: string;
  htmlLink?: string;
};

function assertManagedCalendarId(managedCalendarId: string): void {
  if (!managedCalendarId || managedCalendarId === "primary") {
    throw new Error("A dedicated Aven calendar is required");
  }
}

export function isWritableCalendar(calendar: GoogleCalendar): boolean {
  return calendar.accessRole === "owner" || calendar.accessRole === "writer";
}

export async function listWritableCalendars(tokens: GoogleTokens) {
  const query = new URLSearchParams({ minAccessRole: "writer", showHidden: "false", maxResults: "250" });
  const result = await calendarRequest(tokens, `/users/me/calendarList?${query}`);
  const calendars = ((result.data as { items?: GoogleCalendar[] }).items ?? []).filter(isWritableCalendar);
  return { calendars, tokens: result.tokens };
}

export async function ensureAvenCalendar(tokens: GoogleTokens) {
  const listed = await listWritableCalendars(tokens);
  const existing = listed.calendars.find(
    (calendar) => calendar.summary === AVEN_CALENDAR_NAME && calendar.accessRole === "owner",
  );
  if (existing) return { calendar: existing, tokens: listed.tokens };

  const created = await calendarRequest(listed.tokens, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: AVEN_CALENDAR_NAME, description: AVEN_CALENDAR_DESCRIPTION }),
  });
  const calendar = created.data as Pick<GoogleCalendar, "id" | "summary">;
  if (!calendar.id) throw new Error("Google Calendar did not return an ID for the Aven calendar");
  return {
    calendar: { id: calendar.id, summary: calendar.summary || AVEN_CALENDAR_NAME, accessRole: "owner" } satisfies GoogleCalendar,
    tokens: created.tokens,
  };
}

export async function listManagedCalendarEvents(
  tokens: GoogleTokens,
  managedCalendarId: string,
  timeMin = new Date().toISOString(),
  timeMax = new Date(Date.now() + 7 * 86_400_000).toISOString(),
) {
  assertManagedCalendarId(managedCalendarId);
  const query = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" });
  const calendarId = encodeURIComponent(managedCalendarId);
  const result = await calendarRequest(tokens, `/calendars/${calendarId}/events?${query}`);
  const events = ((result.data as { items?: Array<Record<string, unknown>> }).items ?? []).map((event) => {
    const start = event.start as { dateTime?: string; date?: string } | undefined;
    const end = event.end as { dateTime?: string; date?: string } | undefined;
    return {
      id: String(event.id ?? ""),
      summary: String(event.summary ?? "Untitled event"),
      description: event.description ? String(event.description) : undefined,
      start: start?.dateTime ?? start?.date ?? "",
      end: end?.dateTime ?? end?.date ?? "",
      status: event.status ? String(event.status) : undefined,
      htmlLink: event.htmlLink ? String(event.htmlLink) : undefined,
    } satisfies ManagedCalendarEvent;
  });
  const seen = new Set<string>();
  const uniqueEvents = events.filter((event) => {
    const key = `${event.summary.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${event.start.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return { events: uniqueEvents, tokens: result.tokens };
}

function eventBody(action: Extract<ManagedCalendarAction, { action: "create" | "update" }>) {
  const body: Record<string, unknown> = {};
  if (action.title !== undefined) body.summary = action.title;
  if (action.description !== undefined) body.description = action.description;
  if (action.startsAt !== undefined) body.start = { dateTime: action.startsAt };
  if (action.endsAt) {
    body.end = { dateTime: action.endsAt };
  } else if (action.action === "create") {
    body.end = { dateTime: new Date(new Date(action.startsAt).getTime() + 30 * 60_000).toISOString() };
  } else if (action.startsAt !== undefined && action.endsAt === null) {
    body.end = { dateTime: new Date(new Date(action.startsAt).getTime() + 30 * 60_000).toISOString() };
  }
  if (action.sourceUpdateIds?.length) {
    body.extendedProperties = { private: { avenSourceUpdateIds: action.sourceUpdateIds.join(",") } };
  }
  return body;
}

export async function executeManagedCalendarAction(
  tokens: GoogleTokens,
  managedCalendarId: string,
  action: ManagedCalendarAction,
) {
  assertManagedCalendarId(managedCalendarId);
  const calendarId = encodeURIComponent(managedCalendarId);
  if (action.action === "create") {
    if (!action.title || !action.startsAt) throw new Error("Calendar create requires title and startsAt");
    const result = await calendarRequest(tokens, `/calendars/${calendarId}/events`, {
      method: "POST",
      body: JSON.stringify(eventBody(action)),
    });
    return { action: action.action, event: result.data, tokens: result.tokens };
  }

  if (!action.eventId) throw new Error(`Calendar ${action.action} requires eventId`);
  const eventId = encodeURIComponent(action.eventId);
  if (action.action === "delete") {
    const result = await calendarRequest(tokens, `/calendars/${calendarId}/events/${eventId}`, { method: "DELETE" });
    return { action: action.action, event: null, tokens: result.tokens };
  }

  const result = await calendarRequest(tokens, `/calendars/${calendarId}/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(eventBody(action)),
  });
  return { action: action.action, event: result.data, tokens: result.tokens };
}

export async function executeManagedCalendarActions(
  tokens: GoogleTokens,
  managedCalendarId: string,
  actions: ManagedCalendarAction[],
) {
  let currentTokens = tokens;
  const results: Array<{ action: ManagedCalendarAction["action"]; event: unknown }> = [];
  for (const action of actions) {
    const result = await executeManagedCalendarAction(currentTokens, managedCalendarId, action);
    currentTokens = result.tokens;
    results.push({ action: result.action, event: result.event });
  }
  return { results, tokens: currentTokens };
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
  const text = await response.text();
  return { data: text ? JSON.parse(text) as unknown : null, tokens: current };
}
