import { config } from "../../../../../lib/config";
import { deleteTeamGoogleSession } from "../../../../../lib/db";
import { clearGoogleSessionCookie } from "../../../../../lib/integrations/google-session";

export async function POST() {
  await deleteTeamGoogleSession(config.defaultTeamId());
  const response = Response.json({ connected: false });
  response.headers.append("set-cookie", clearGoogleSessionCookie());
  return response;
}
