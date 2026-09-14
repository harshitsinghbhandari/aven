import { claimPendingUpdates, getLatestState, releaseUpdates, saveReconciliation } from "../../../../lib/db";
import { serverError, unauthorized } from "../../../../lib/http";
import { reconcileTeamState } from "../../../../lib/reconcile";
import { isUuid, readTeamId } from "../../../../lib/team-id";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const authError = unauthorized(request); if (authError) return authError;
  const teamId = readTeamId(request); if (!isUuid(teamId)) return Response.json({ error: "A valid teamId is required" }, { status: 400 });
  const updates = await claimPendingUpdates(teamId);
  if (!updates.length) return Response.json({ processed: 0, state: await getLatestState(teamId) });
  try {
    const previous = await getLatestState(teamId);
    const result = await reconcileTeamState(previous.state, updates);
    const state = await saveReconciliation(teamId, updates.map((update) => update.id), result);
    return Response.json({ processed: updates.length, state, stateChanges: result.stateChanges, attentionItems: result.attentionItems, calendarActions: result.calendarActions });
  } catch (error) {
    await releaseUpdates(updates.map((update) => update.id), error);
    return serverError(error);
  }
}
