import { getLatestState, getTeam, listAttention, listUpdates } from "../../../lib/db";
import { config } from "../../../lib/config";
import { serverError, unauthorized } from "../../../lib/http";
import { isUuid, readTeamId } from "../../../lib/team-id";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const authError = unauthorized(request); if (authError) return authError;
    const teamId = readTeamId(request, config.defaultTeamId()); if (!isUuid(teamId)) return Response.json({ error: "A valid teamId is required" }, { status: 400 });
    const [team, snapshot, attention, updates] = await Promise.all([getTeam(teamId), getLatestState(teamId), listAttention(teamId), listUpdates(teamId, 20)]);
    if (!team) return Response.json({ error: "Team not found" }, { status: 404 });
    return Response.json({
      generatedAt: new Date().toISOString(), team,
      state: { version: snapshot.version, updatedAt: snapshot.version ? snapshot.createdAt : null, attention,
        progress: snapshot.state.progress, blocker: snapshot.state.blockers, decision: snapshot.state.decisions,
        commitment: snapshot.state.commitments, deadline: snapshot.state.deadlines, signal: snapshot.state.signals },
      recentUpdates: updates.map((update) => ({ id: update.id, speaker: update.userName, userId: update.userId, text: update.text, createdAt: update.createdAt })),
    });
  } catch (error) { return serverError(error); }
}
