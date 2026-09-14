import { clearGoogleSessionCookie } from "../../../../../lib/integrations/google-session";

export async function POST() {
  const response = Response.json({ connected: false });
  response.headers.append("set-cookie", clearGoogleSessionCookie());
  return response;
}
