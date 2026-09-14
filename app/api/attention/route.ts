import { listAttention } from "../../../lib/db";
import { serverError, unauthorized } from "../../../lib/http";
import { isUuid, readTeamId } from "../../../lib/team-id";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const authError = unauthorized(request); if (authError) return authError;
    const teamId = readTeamId(request); if (!isUuid(teamId)) return Response.json({ error: "A valid teamId is required" }, { status: 400 });
    return Response.json({ attention: await listAttention(teamId) });
  } catch (error) { return serverError(error); }
}
