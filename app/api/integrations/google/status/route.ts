import { readGoogleSession } from "../../../../../lib/integrations/google-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readGoogleSession(request);
  return Response.json({
    connected: Boolean(session),
    selectedCalendarId: session?.selectedCalendarId ?? null,
  });
}
