import { serverError, unauthorized } from "../../../../lib/http";
import { runReconciliation } from "../../../../lib/run-reconciliation";
import { isUuid, readTeamId } from "../../../../lib/team-id";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const authError = unauthorized(request); if (authError) return authError;
  const teamId = readTeamId(request); if (!isUuid(teamId)) return Response.json({ error: "A valid teamId is required" }, { status: 400 });
  try {
    return Response.json(await runReconciliation(teamId));
  } catch (error) {
    return serverError(error);
  }
}
