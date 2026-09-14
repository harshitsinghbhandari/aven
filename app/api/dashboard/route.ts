import { after } from "next/server";
import { getLatestState, getTeam, listAttention, listTeamMembers, listUpdates } from "../../../lib/db";
import { config } from "../../../lib/config";
import { serverError } from "../../../lib/http";
import { runReconciliation } from "../../../lib/run-reconciliation";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET() {
  try {
    const teamId = config.defaultTeamId();
    const [team, snapshot, attention, updates, members] = await Promise.all([
      getTeam(teamId), getLatestState(teamId), listAttention(teamId), listUpdates(teamId, 20), listTeamMembers(teamId),
    ]);
    if (!team) return Response.json({ error: "Team not found" }, { status: 404 });
    after(async () => {
      try { await runReconciliation(teamId); } catch (error) { console.error("Reconciliation failed after dashboard refresh", error); }
    });
    return Response.json({
      generatedAt: new Date().toISOString(), team, members,
      state: { version: snapshot.version, updatedAt: snapshot.version ? snapshot.createdAt : null, attention,
        progress: snapshot.state.progress, blocker: snapshot.state.blockers, decision: snapshot.state.decisions,
        commitment: snapshot.state.commitments, deadline: snapshot.state.deadlines, signal: snapshot.state.signals },
      recentUpdates: updates.map((update) => ({
        id: update.id, speaker: update.userName, userId: update.userId, text: update.text,
        createdAt: update.createdAt, status: update.status, processedAt: update.processedAt,
        processingStartedAt: update.processingStartedAt, processingError: update.processingError,
      })),
    });
  } catch (error) { return serverError(error); }
}
