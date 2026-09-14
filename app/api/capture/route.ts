import { readAudio } from "../../../lib/audio";
import { createVoiceUpdate } from "../../../lib/db";
import { serverError, unauthorized } from "../../../lib/http";
import { isUuid } from "../../../lib/team-id";
import { transcribe } from "../../../lib/transcribe";

export const runtime = "nodejs";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const authError = unauthorized(request);
    if (authError) return authError;
    const teamId = request.headers.get("x-team-id");
    const userId = request.headers.get("x-user-id");
    if (!isUuid(teamId) || !isUuid(userId)) return Response.json({ error: "Valid X-Team-Id and X-User-Id headers are required" }, { status: 400 });

    let text: string;
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await request.json() as { text?: unknown };
      if (typeof body.text !== "string" || !body.text.trim()) return Response.json({ error: "A nonempty text field is required" }, { status: 400 });
      text = body.text.trim();
    } else {
      const audio = await readAudio(request);
      if (!audio || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "Audio must be between 1 byte and 25 MB" }, { status: 400 });
      if (audio.type && !audio.type.startsWith("audio/")) return Response.json({ error: "Uploaded file must be audio" }, { status: 415 });
      text = await transcribe(audio);
    }
    const update = await createVoiceUpdate(teamId, userId, text);
    return Response.json({ update }, { status: 201 });
  } catch (error) { return serverError(error); }
}
