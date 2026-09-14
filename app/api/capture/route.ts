import { readAudio } from "../../../lib/audio";
import { readCaptureIdentity } from "../../../lib/auth";
import { createVoiceUpdate } from "../../../lib/db";
import { serverError } from "../../../lib/http";
import { isUuid } from "../../../lib/team-id";
import { transcribe } from "../../../lib/transcribe";

export const runtime = "nodejs";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const identity = readCaptureIdentity(request);
    if (!identity || !isUuid(identity.teamId) || !isUuid(identity.userId)) return Response.json({ error: "Invalid member capture credential" }, { status: 401 });

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
    const update = await createVoiceUpdate(identity.teamId, identity.userId, text);
    return Response.json({ success: true, update }, { status: 201 });
  } catch (error) { return serverError(error); }
}
