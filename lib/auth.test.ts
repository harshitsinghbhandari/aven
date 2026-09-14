import { afterEach, describe, expect, it } from "vitest";
import { createCaptureCredential, isAuthorized, isShortcutSetupAuthorized, readCaptureIdentity } from "./auth";

afterEach(() => {
  delete process.env.VOICE_INBOX_TOKEN;
  delete process.env.SHORTCUT_SETUP_TOKEN;
});

describe("isAuthorized", () => {
  it("accepts the configured bearer token", () => {
    process.env.VOICE_INBOX_TOKEN = "secret";
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer secret" },
    });
    expect(isAuthorized(request)).toBe(true);
  });

  it("rejects missing and incorrect tokens", () => {
    process.env.VOICE_INBOX_TOKEN = "secret";
    expect(isAuthorized(new Request("http://localhost"))).toBe(false);
    expect(isAuthorized(new Request("http://localhost", {
      headers: { Authorization: "Bearer wrong" },
    }))).toBe(false);
  });

  it("round trips a signed member capture identity", () => {
    process.env.VOICE_INBOX_TOKEN = "application-secret";
    const identity = { teamId: "a0000000-0000-4000-8000-000000000001", userId: "b0000000-0000-4000-8000-000000000001" };
    const credential = createCaptureCredential(identity);
    expect(createCaptureCredential(identity)).toBe(credential);
    const request = new Request("http://localhost/api/capture", { headers: { Authorization: `Bearer ${credential}` } });
    expect(readCaptureIdentity(request)).toEqual(identity);
    expect(credential).not.toContain("application-secret");
  });

  it("rejects a modified member capture credential", () => {
    process.env.VOICE_INBOX_TOKEN = "application-secret";
    const credential = createCaptureCredential({ teamId: "team", userId: "user" });
    const request = new Request("http://localhost/api/capture", { headers: { Authorization: `Bearer ${credential.slice(0, -1)}x` } });
    expect(readCaptureIdentity(request)).toBeNull();
  });

  it("authorizes setup only with its dedicated secret", () => {
    process.env.VOICE_INBOX_TOKEN = "application-secret";
    process.env.SHORTCUT_SETUP_TOKEN = "setup-secret";
    expect(isShortcutSetupAuthorized(new Request("http://localhost", { headers: { Authorization: "Bearer setup-secret" } }))).toBe(true);
    expect(isShortcutSetupAuthorized(new Request("http://localhost", { headers: { Authorization: "Bearer application-secret" } }))).toBe(false);
  });
});
