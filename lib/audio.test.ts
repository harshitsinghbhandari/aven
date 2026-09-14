import { describe, expect, it } from "vitest";
import { readAudio } from "./audio";

describe("readAudio", () => {
  it("reads the multipart format used by form uploads", async () => {
    const form = new FormData();
    form.set("audio", new File(["audio"], "note.m4a", { type: "audio/mp4" }));

    const audio = await readAudio(new Request("http://localhost/api/notes", {
      method: "POST",
      body: form,
    }));

    expect(audio?.name).toBe("note.m4a");
    expect(audio?.size).toBe(5);
  });

  it("reads the raw-file format sent by Apple Shortcuts", async () => {
    const audio = await readAudio(new Request("http://localhost/api/notes", {
      method: "POST",
      headers: { "Content-Type": "audio/mp4" },
      body: "audio",
    }));

    expect(audio?.name).toBe("recording.m4a");
    expect(audio?.type).toBe("audio/mp4");
    expect(audio?.size).toBe(5);
  });

  it("rejects unsupported request bodies", async () => {
    const audio = await readAudio(new Request("http://localhost/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }));

    expect(audio).toBeNull();
  });
});
