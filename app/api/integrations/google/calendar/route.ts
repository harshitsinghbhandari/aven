import { executeManagedCalendarAction, listManagedCalendarEvents } from "../../../../../lib/integrations/google-calendar";
import { config } from "../../../../../lib/config";
import { loadTeamGoogleSession, storeTeamGoogleSession } from "../../../../../lib/integrations/google-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const teamId = config.defaultTeamId();
  const session = await loadTeamGoogleSession(teamId);
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const url = new URL(request.url);
  const timeMin = url.searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax = url.searchParams.get("timeMax") ?? new Date(Date.now() + 7 * 86_400_000).toISOString();
  const result = await listManagedCalendarEvents(session.tokens, session.managedCalendarId, timeMin, timeMax);
  await storeTeamGoogleSession(teamId, { ...session, tokens: result.tokens });
  return Response.json({ events: result.events, selectedCalendarId: session.managedCalendarId, managedCalendarId: session.managedCalendarId });
}

export async function POST(request: Request) {
  const teamId = config.defaultTeamId();
  const session = await loadTeamGoogleSession(teamId);
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const body = (await request.json()) as { summary?: string; description?: string; start?: string; end?: string };
  if (!body.summary || !body.start) return Response.json({ error: "summary and start are required" }, { status: 400 });
  const result = await executeManagedCalendarAction(session.tokens, session.managedCalendarId, {
    action: "create", title: body.summary, description: body.description, startsAt: body.start, endsAt: body.end,
  });
  await storeTeamGoogleSession(teamId, { ...session, tokens: result.tokens });
  return Response.json({ event: result.event, selectedCalendarId: session.managedCalendarId, managedCalendarId: session.managedCalendarId });
}

export async function PATCH(request: Request) {
  const teamId = config.defaultTeamId();
  const session = await loadTeamGoogleSession(teamId);
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const body = (await request.json()) as { eventId?: string; summary?: string; description?: string; start?: string; end?: string | null };
  if (!body.eventId) return Response.json({ error: "eventId is required" }, { status: 400 });
  const result = await executeManagedCalendarAction(session.tokens, session.managedCalendarId, {
    action: "update", eventId: body.eventId, title: body.summary, description: body.description,
    startsAt: body.start, endsAt: body.end,
  });
  await storeTeamGoogleSession(teamId, { ...session, tokens: result.tokens });
  return Response.json({ event: result.event, managedCalendarId: session.managedCalendarId });
}

export async function DELETE(request: Request) {
  const teamId = config.defaultTeamId();
  const session = await loadTeamGoogleSession(teamId);
  if (!session) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });
  const result = await executeManagedCalendarAction(session.tokens, session.managedCalendarId, {
    action: "delete", eventId,
  });
  await storeTeamGoogleSession(teamId, { ...session, tokens: result.tokens });
  return Response.json({ deleted: true, eventId, managedCalendarId: session.managedCalendarId });
}
