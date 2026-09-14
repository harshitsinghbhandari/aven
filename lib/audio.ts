export async function readAudio(request: Request): Promise<File | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const audio = form.get("audio");
    return audio instanceof File ? audio : null;
  }

  if (contentType.startsWith("audio/") || contentType === "application/octet-stream") {
    const audio = await request.blob();
    return new File([audio], "recording.m4a", { type: audio.type || "audio/mp4" });
  }

  return null;
}
