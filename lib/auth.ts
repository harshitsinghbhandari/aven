import { timingSafeEqual } from "node:crypto";
import { config } from "./config";

export function isAuthorized(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${config.token()}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
