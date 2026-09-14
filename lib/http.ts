import { NextResponse } from "next/server";
import { isAuthorized } from "./auth";

export function unauthorized(request: Request): NextResponse | null {
  return isAuthorized(request)
    ? null
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function serverError(error: unknown): NextResponse {
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
