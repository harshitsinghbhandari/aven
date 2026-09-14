export function readTeamId(request: Request, fallback: string | null = null): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("teamId") ?? request.headers.get("x-team-id") ?? fallback;
}

export function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
