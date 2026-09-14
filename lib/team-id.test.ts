import { describe, expect, it } from "vitest";
import { isUuid, readTeamId } from "./team-id";

describe("team identity", () => {
  it("reads query parameters and headers", () => {
    expect(readTeamId(new Request("http://localhost/api/state?teamId=query"))).toBe("query");
    expect(readTeamId(new Request("http://localhost/api/state", { headers: { "X-Team-Id": "header" } }))).toBe("header");
  });
  it("validates UUIDs", () => {
    expect(isUuid("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(isUuid("team")).toBe(false);
  });
});
