import { config } from "../../../../../lib/config";
import { loadTeamGoogleSession } from "../../../../../lib/integrations/google-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadTeamGoogleSession(config.defaultTeamId());
  return Response.json({
    connected: Boolean(session),
    selectedCalendarId: session?.managedCalendarId ?? null,
    managedCalendar: session ? { id: session.managedCalendarId, summary: "Aven" } : null,
  });
}
