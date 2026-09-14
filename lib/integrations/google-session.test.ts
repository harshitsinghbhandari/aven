import { beforeEach, describe, expect, it, vi } from "vitest";
import { googleSessionCookie, readGoogleSession } from "./google-session";

describe("Google session cookie", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  });

  it("round trips tokens and the selected calendar", () => {
    const session = {
      tokens: { access_token: "access", refresh_token: "refresh", expires_at: 123 },
      selectedCalendarId: "team@example.com",
    };
    const cookie = googleSessionCookie(session).split(";", 1)[0];
    const request = new Request("https://aven.test", { headers: { cookie } });
    expect(readGoogleSession(request)).toEqual(session);
  });

  it("treats a malformed cookie as disconnected", () => {
    const request = new Request("https://aven.test", { headers: { cookie: "aven_google=invalid" } });
    expect(readGoogleSession(request)).toBeNull();
  });
});
