import { AVEN_CALENDAR_NAME } from "../../../../../lib/integrations/google-calendar";
import { config } from "../../../../../lib/config";
import { loadTeamGoogleSession } from "../../../../../lib/integrations/google-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadTeamGoogleSession(config.defaultTeamId());
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  return Response.json({
    calendars: [{ id: session.managedCalendarId, summary: AVEN_CALENDAR_NAME, accessRole: "owner" }],
    selectedCalendarId: session.managedCalendarId,
    managedCalendarId: session.managedCalendarId,
  });
}

export async function POST(request: Request) {
  const session = await loadTeamGoogleSession(config.defaultTeamId());
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const body = (await request.json()) as { calendarId?: string };
  if (!body.calendarId) return Response.json({ error: "calendarId is required" }, { status: 400 });
  if (body.calendarId !== session.managedCalendarId) {
    return Response.json({ error: "Aven can only use its managed calendar" }, { status: 400 });
  }
  return Response.json({ selectedCalendarId: session.managedCalendarId, managedCalendarId: session.managedCalendarId });
}
