import type { PushSubscription } from "web-push";
import { unauthorized } from "../../../../../lib/http";
import { sendNotification, type AvenNotification } from "../../../../../lib/integrations/web-push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = unauthorized(request);
  if (authError) return authError;
  const body = (await request.json()) as { subscription?: PushSubscription; notification?: AvenNotification };
  if (!body.subscription?.endpoint || !body.notification?.title || !body.notification.body) {
    return Response.json({ error: "subscription, notification.title, and notification.body are required" }, { status: 400 });
  }
  await sendNotification(body.subscription, body.notification);
  return Response.json({ delivered: true });
}
