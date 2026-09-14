import { storeNote } from "./store.mjs";

const baseUrl = required("VOICE_INBOX_URL").replace(/\/$/, "");
const token = required("VOICE_INBOX_TOKEN");
const pollInterval = positiveInteger(process.env.VOICE_INBOX_POLL_INTERVAL_MS ?? "15000");
const headers = { Authorization: `Bearer ${token}` };

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function positiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("VOICE_INBOX_POLL_INTERVAL_MS must be a positive integer");
  }
  return parsed;
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status}`);
  return response;
}

async function handleVoiceNote(note) {
  const stored = await storeNote(note);
  console.log(`[${stored.index}] [${stored.createdAt}] ${stored.text}`);
}

async function poll() {
  const response = await api("/api/notes");
  const { notes } = await response.json();

  for (const note of notes) {
    await handleVoiceNote(note);
    await api(`/api/notes/${encodeURIComponent(note.id)}/ack`, { method: "POST" });
  }
}

console.log(`Voice Inbox client polling ${baseUrl} every ${pollInterval}ms`);
while (!stopping) {
  try {
    await poll();
  } catch (error) {
    console.error(new Date().toISOString(), error instanceof Error ? error.message : error);
  }
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, pollInterval));
}
