import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const dataDirectory = process.env.VOICE_INBOX_DATA_DIR
  ?? join(homedir(), "Library", "Application Support", "Voice Inbox");

const notesPath = join(dataDirectory, "notes.jsonl");
const statePath = join(dataDirectory, "state.json");

export async function readNotes() {
  try {
    const contents = await readFile(notesPath, "utf8");
    return contents
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function storeNote(note) {
  await mkdir(dataDirectory, { recursive: true });
  const notes = await readNotes();
  const existing = notes.find((stored) => stored.id === note.id);
  if (existing) return existing;

  const stored = {
    index: (notes.at(-1)?.index ?? 0) + 1,
    id: note.id,
    text: note.text,
    createdAt: note.createdAt,
    receivedAt: new Date().toISOString(),
  };
  await appendFile(notesPath, `${JSON.stringify(stored)}\n`, { mode: 0o600 });
  return stored;
}

export async function readLastFetchedIndex() {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    return Number.isInteger(state.lastFetchedIndex) ? state.lastFetchedIndex : 0;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}

export async function writeLastFetchedIndex(index) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ lastFetchedIndex: index })}\n`, { mode: 0o600 });
  await rename(temporaryPath, statePath);
}
