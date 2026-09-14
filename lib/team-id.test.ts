import { describe, expect, it } from "vitest";
import { isUuid, readTeamId } from "./team-id";

describe("team identity", () => {
  it("reads query parameters and headers", () => {
    expect(readTeamId(new Request("http://localhost/api/state?teamId=query"))).toBe("query");
    expect(readTeamId(new Request("http://localhost/api/state", { headers: { "X-Team-Id": "header" } }))).toBe("header");
  });
  it("uses the configured team fallback when the browser omits teamId", () => {
    const fallback = "a0000000-0000-4000-8000-000000000001";
    expect(readTeamId(new Request("https://voice-inbox-two.vercel.app/api/members/setup"), fallback)).toBe(fallback);
  });
  it("validates UUIDs", () => {
    expect(isUuid("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(isUuid("team")).toBe(false);
  });
});
