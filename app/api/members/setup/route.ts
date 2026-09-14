import { createCaptureCredential, isShortcutSetupAuthorized } from "../../../../lib/auth";
import { config } from "../../../../lib/config";
import { getTeam, listTeamMembers } from "../../../../lib/db";
import { serverError } from "../../../../lib/http";
import { isUuid, readTeamId } from "../../../../lib/team-id";

export const runtime = "nodejs";

function isLocalDevelopment(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return process.env.NODE_ENV === "development" && (hostname === "localhost" || hostname === "127.0.0.1");
}

export async function GET(request: Request) {
  try {
    if (!isLocalDevelopment(request)) {
      if (!isShortcutSetupAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const teamId = readTeamId(request, config.defaultTeamId());
    if (!isUuid(teamId)) return Response.json({ error: "A valid teamId is required" }, { status: 400 });
    const [team, members] = await Promise.all([getTeam(teamId), listTeamMembers(teamId)]);
    if (!team) return Response.json({ error: "Team not found" }, { status: 404 });
    const url = `${new URL(request.url).origin}/api/capture`;
    return Response.json({
      team: { id: team.id, name: team.name },
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        shortcut: {
          name: `Capture for ${member.name}`,
          url,
          method: "POST",
          headers: { Authorization: `Bearer ${createCaptureCredential({ teamId, userId: member.id })}` },
          body: { type: "multipart", field: "audio" },
          successMessage: "Update captured",
        },
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}
