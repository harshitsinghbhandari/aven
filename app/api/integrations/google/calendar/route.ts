import { calendarRequest, type GoogleTokens } from "../../../../../lib/integrations/google-calendar";
import { decryptToken, encryptToken } from "../../../../../lib/integrations/secure-token";

export const runtime = "nodejs";

function tokensFrom(request: Request): GoogleTokens | null {
  const raw = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("aven_google="))?.slice(12);
  return raw ? decryptToken<GoogleTokens>(decodeURIComponent(raw)) : null;
}

function withTokens(data: unknown, tokens: GoogleTokens) {
  const response = Response.json(data);
  response.headers.append("set-cookie", `aven_google=${encryptToken(tokens)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
  return response;
}

export async function GET(request: Request) {
  const tokens = tokensFrom(request);
  if (!tokens) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const url = new URL(request.url);
  const timeMin = url.searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax = url.searchParams.get("timeMax") ?? new Date(Date.now() + 7 * 86_400_000).toISOString();
  const query = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" });
  const result = await calendarRequest(tokens, `/calendars/primary/events?${query}`);
  return withTokens({ events: (result.data as { items?: unknown[] }).items ?? [] }, result.tokens);
}

export async function POST(request: Request) {
  const tokens = tokensFrom(request);
  if (!tokens) return Response.json({ error: "Google Calendar is not connected" }, { status: 401 });
  const body = (await request.json()) as { summary?: string; description?: string; start?: string; end?: string };
  if (!body.summary || !body.start) return Response.json({ error: "summary and start are required" }, { status: 400 });
  const end = body.end ?? new Date(new Date(body.start).getTime() + 30 * 60_000).toISOString();
  const result = await calendarRequest(tokens, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify({ summary: body.summary, description: body.description, start: { dateTime: body.start }, end: { dateTime: end } }),
  });
  return withTokens({ event: result.data }, result.tokens);
}
