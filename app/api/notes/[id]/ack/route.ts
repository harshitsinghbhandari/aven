import { acknowledgeNote } from "../../../../../lib/db";
import { serverError, unauthorized } from "../../../../../lib/http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authError = unauthorized(request);
    if (authError) return authError;

    const { id } = await context.params;
    const found = await acknowledgeNote(id);
    return found
      ? Response.json({ success: true })
      : Response.json({ error: "Note not found" }, { status: 404 });
  } catch (error) {
    return serverError(error);
  }
}
