import { createNote, listPendingNotes } from "../../../lib/db";
import { readAudio } from "../../../lib/audio";
import { serverError, unauthorized } from "../../../lib/http";
import { transcribe } from "../../../lib/transcribe";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const authError = unauthorized(request);
    if (authError) return authError;

    const audio = await readAudio(request);
    if (!audio) {
      return Response.json(
        { error: "Expected a raw audio file or an audio file in the multipart 'audio' field" },
        { status: 400 },
      );
    }
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "Audio must be between 1 byte and 25 MB" }, { status: 400 });
    }
    if (audio.type && !audio.type.startsWith("audio/")) {
      return Response.json({ error: "Uploaded file must be audio" }, { status: 415 });
    }

    const text = await transcribe(audio);
    const note = await createNote(text);
    return Response.json({ success: true, id: note.id, text: note.text }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}

export async function GET(request: Request) {
  try {
    const authError = unauthorized(request);
    if (authError) return authError;
    return Response.json({ notes: await listPendingNotes() });
  } catch (error) {
    return serverError(error);
  }
}
