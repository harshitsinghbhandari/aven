import { listWritableCalendars } from "../../../../../lib/integrations/google-calendar";
import { jsonWithGoogleSession, readGoogleSession } from "../../../../../lib/integrations/google-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readGoogleSession(request);
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const result = await listWritableCalendars(session.tokens);
  const selectedCalendarId = result.calendars.some((calendar) => calendar.id === session.selectedCalendarId)
    ? session.selectedCalendarId
    : result.calendars.find((calendar) => calendar.primary)?.id ?? result.calendars[0]?.id ?? null;
  return jsonWithGoogleSession(
    { calendars: result.calendars, selectedCalendarId },
    { tokens: result.tokens, selectedCalendarId: selectedCalendarId ?? "primary" },
  );
}

export async function POST(request: Request) {
  const session = readGoogleSession(request);
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const body = (await request.json()) as { calendarId?: string };
  if (!body.calendarId) return Response.json({ error: "calendarId is required" }, { status: 400 });
  const result = await listWritableCalendars(session.tokens);
  if (!result.calendars.some((calendar) => calendar.id === body.calendarId)) {
    return Response.json({ error: "Calendar is not writable or does not exist" }, { status: 400 });
  }
  return jsonWithGoogleSession(
    { selectedCalendarId: body.calendarId },
    { tokens: result.tokens, selectedCalendarId: body.calendarId },
  );
}
