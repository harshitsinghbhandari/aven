import { listUpdates } from "../../../lib/db";
import { serverError, unauthorized } from "../../../lib/http";
import { isUuid, readTeamId } from "../../../lib/team-id";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const authError = unauthorized(request); if (authError) return authError;
    const teamId = readTeamId(request); if (!isUuid(teamId)) return Response.json({ error: "A valid teamId is required" }, { status: 400 });
    const requested = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(requested) ? Math.min(100, Math.max(1, Math.trunc(requested))) : 50;
    return Response.json({ updates: await listUpdates(teamId, limit) });
  } catch (error) { return serverError(error); }
}
