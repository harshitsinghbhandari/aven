import { afterEach, describe, expect, it } from "vitest";
import { isAuthorized } from "./auth";

afterEach(() => delete process.env.VOICE_INBOX_TOKEN);

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
});
