import { exchangeCode } from "../../../../../lib/integrations/google-calendar";
import { encryptToken, verifyState } from "../../../../../lib/integrations/secure-token";

export const runtime = "nodejs";

function cookie(request: Request, name: string): string | undefined {
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = cookie(request, "aven_google_state");
  if (!code || !state || !expected || state !== decodeURIComponent(expected) || !verifyState(state)) {
    return Response.json({ error: "Invalid OAuth callback" }, { status: 400 });
  }
  const tokens = await exchangeCode(code);
  const response = new Response(null, {
    status: 302,
    headers: { location: new URL("/?calendar=connected", request.url).toString() },
  });
  response.headers.append("set-cookie", `aven_google=${encryptToken(tokens)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
  response.headers.append("set-cookie", "aven_google_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return response;
}
