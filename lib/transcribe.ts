import { config } from "./config";

export async function transcribe(file: File): Promise<string> {
  const body = new FormData();
  body.set("file", file, file.name || "recording.m4a");
  body.set("model", "whisper-large-v3-turbo");
  body.set("response_format", "json");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.groqApiKey()}` },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq transcription failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as { text?: unknown };
  if (typeof result.text !== "string" || !result.text.trim()) {
    throw new Error("Groq returned an empty transcription");
  }
  return result.text.trim();
}
