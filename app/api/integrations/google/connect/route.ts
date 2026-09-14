import { randomBytes } from "node:crypto";
import { authorizationUrl } from "../../../../../lib/integrations/google-calendar";
import { signState } from "../../../../../lib/integrations/secure-token";

export const runtime = "nodejs";

export async function GET() {
  const state = signState(randomBytes(24).toString("base64url"));
  return new Response(null, {
    status: 302,
    headers: {
      location: authorizationUrl(state),
      "set-cookie": `aven_google_state=${encodeURIComponent(state)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
