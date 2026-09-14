import { calendarRequest } from "../../../../../lib/integrations/google-calendar";
import { jsonWithGoogleSession, readGoogleSession } from "../../../../../lib/integrations/google-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readGoogleSession(request);
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const url = new URL(request.url);
  const timeMin = url.searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax = url.searchParams.get("timeMax") ?? new Date(Date.now() + 7 * 86_400_000).toISOString();
  const query = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" });
  const calendarId = encodeURIComponent(session.selectedCalendarId);
  const result = await calendarRequest(session.tokens, `/calendars/${calendarId}/events?${query}`);
  return jsonWithGoogleSession(
    { events: (result.data as { items?: unknown[] }).items ?? [], selectedCalendarId: session.selectedCalendarId },
    { ...session, tokens: result.tokens },
  );
}

export async function POST(request: Request) {
  const session = readGoogleSession(request);
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const body = (await request.json()) as { summary?: string; description?: string; start?: string; end?: string };
  if (!body.summary || !body.start) return Response.json({ error: "summary and start are required" }, { status: 400 });
  const end = body.end ?? new Date(new Date(body.start).getTime() + 30 * 60_000).toISOString();
  const calendarId = encodeURIComponent(session.selectedCalendarId);
  const result = await calendarRequest(session.tokens, `/calendars/${calendarId}/events`, {
    method: "POST",
    body: JSON.stringify({ summary: body.summary, description: body.description, start: { dateTime: body.start }, end: { dateTime: end } }),
  });
  return jsonWithGoogleSession(
    { event: result.data, selectedCalendarId: session.selectedCalendarId },
    { ...session, tokens: result.tokens },
  );
}
