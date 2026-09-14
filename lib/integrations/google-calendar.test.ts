import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureAvenCalendar,
  executeManagedCalendarAction,
  executeManagedCalendarActions,
  isWritableCalendar,
  listManagedCalendarEvents,
  listWritableCalendars,
  refreshTokens,
} from "./google-calendar";

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

  it("reuses an owner controlled Aven calendar", async () => {
    const tokens = { access_token: "access", expires_at: Date.now() + 120_000 };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [
      { id: "shared", summary: "Aven", accessRole: "writer" },
      { id: "managed", summary: "Aven", accessRole: "owner" },
    ] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureAvenCalendar(tokens);

    expect(result.calendar.id).toBe("managed");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("creates the Aven calendar when the account does not own one", async () => {
    const tokens = { access_token: "access", expires_at: Date.now() + 120_000 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "new-aven", summary: "Aven" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureAvenCalendar(tokens);

    expect(result.calendar).toEqual({ id: "new-aven", summary: "Aven", accessRole: "owner" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://www.googleapis.com/calendar/v3/calendars");
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      summary: "Aven",
      description: "Created and maintained by Aven",
    });
  });

  it("creates events only in the supplied managed calendar", async () => {
    const tokens = { access_token: "access", expires_at: Date.now() + 120_000 };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "event-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await executeManagedCalendarAction(tokens, "aven/calendar@example.com", {
      action: "create",
      title: "Ship demo",
      startsAt: "2026-09-15T10:00:00.000Z",
      sourceUpdateIds: ["update-1"],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/aven%2Fcalendar%40example.com/events",
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      summary: "Ship demo",
      start: { dateTime: "2026-09-15T10:00:00.000Z" },
      end: { dateTime: "2026-09-15T10:30:00.000Z" },
      extendedProperties: { private: { avenSourceUpdateIds: "update-1" } },
    });
  });

  it("lists normalized event context from only the managed calendar", async () => {
    const tokens = { access_token: "access", expires_at: Date.now() + 120_000 };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{
      id: "event-1",
      summary: "Demo deadline",
      start: { dateTime: "2026-09-15T10:00:00.000Z" },
      end: { dateTime: "2026-09-15T10:30:00.000Z" },
    }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listManagedCalendarEvents(
      tokens,
      "aven-id",
      "2026-09-15T00:00:00.000Z",
      "2026-09-16T00:00:00.000Z",
    );

    expect(result.events).toEqual([{
      id: "event-1",
      summary: "Demo deadline",
      start: "2026-09-15T10:00:00.000Z",
      end: "2026-09-15T10:30:00.000Z",
      description: undefined,
      status: undefined,
      htmlLink: undefined,
    }]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/calendars/aven-id/events?");
  });

  it("updates and deletes events in the same managed calendar", async () => {
    const tokens = { access_token: "access", expires_at: Date.now() + 120_000 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "event/1", summary: "Updated" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeManagedCalendarActions(tokens, "aven-id", [
      { action: "update", eventId: "event/1", title: "Updated" },
      { action: "delete", eventId: "event/1" },
    ]);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://www.googleapis.com/calendar/v3/calendars/aven-id/events/event%2F1",
      "https://www.googleapis.com/calendar/v3/calendars/aven-id/events/event%2F1",
    ]);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("PATCH");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("DELETE");
    expect(result.results).toEqual([
      { action: "update", event: { id: "event/1", summary: "Updated" } },
      { action: "delete", event: null },
    ]);
  });

  it("refuses to mutate the primary calendar", async () => {
    await expect(executeManagedCalendarAction(
      { access_token: "access", expires_at: Date.now() + 120_000 },
      "primary",
      { action: "delete", eventId: "event-1" },
    )).rejects.toThrow("A dedicated Aven calendar is required");
  });
});
