import { afterEach, describe, expect, it, vi } from "vitest";
import { isWritableCalendar, listWritableCalendars, refreshTokens } from "./google-calendar";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google Calendar integration", () => {
  it("recognizes calendars that accept event writes", () => {
    expect(isWritableCalendar({ id: "1", summary: "Owned", accessRole: "owner" })).toBe(true);
    expect(isWritableCalendar({ id: "2", summary: "Writable", accessRole: "writer" })).toBe(true);
    expect(isWritableCalendar({ id: "3", summary: "Read only", accessRole: "reader" })).toBe(false);
  });

  it("lists only writable calendars and keeps current tokens", async () => {
    const tokens = { access_token: "access", refresh_token: "refresh", expires_at: Date.now() + 120_000 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [
      { id: "owner", summary: "Owner", accessRole: "owner" },
      { id: "reader", summary: "Reader", accessRole: "reader" },
    ] }), { status: 200 })));
    const result = await listWritableCalendars(tokens);
    expect(result.calendars.map((calendar) => calendar.id)).toEqual(["owner"]);
    expect(result.tokens).toBe(tokens);
  });

  it("preserves the refresh token when Google omits it during refresh", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("APP_URL", "http://localhost:3699");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: "new-access",
      expires_in: 3600,
    }), { status: 200 })));
    const result = await refreshTokens({ access_token: "old", refresh_token: "keep-me", expires_at: 0 });
    expect(result.refresh_token).toBe("keep-me");
    expect(result.access_token).toBe("new-access");
  });
});
