import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const directory = `/tmp/voice-inbox-store-test-${process.pid}`;

beforeEach(() => {
  vi.resetModules();
  process.env.VOICE_INBOX_DATA_DIR = directory;
});

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await rm(directory, { recursive: true, force: true });
  delete process.env.VOICE_INBOX_DATA_DIR;
});

describe("local note store", () => {
  it("assigns stable sequential indexes and deduplicates note IDs", async () => {
    const store = await import("./store.mjs");
    const first = await store.storeNote({ id: "a", text: "one", createdAt: "2026-01-01T00:00:00Z" });
    const duplicate = await store.storeNote({ id: "a", text: "one", createdAt: "2026-01-01T00:00:00Z" });
    const second = await store.storeNote({ id: "b", text: "two", createdAt: "2026-01-02T00:00:00Z" });

    expect(first.index).toBe(1);
    expect(duplicate.index).toBe(1);
    expect(second.index).toBe(2);
    expect(await store.readNotes()).toHaveLength(2);
  });

  it("persists the last fetched index", async () => {
    const store = await import("./store.mjs");
    expect(await store.readLastFetchedIndex()).toBe(0);
    await store.writeLastFetchedIndex(12);
    expect(await store.readLastFetchedIndex()).toBe(12);
  });
});
