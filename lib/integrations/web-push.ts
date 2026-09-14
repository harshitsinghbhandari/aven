import webpush, { type PushSubscription } from "web-push";

function configure() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY are required");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export type AvenNotification = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendNotification(subscription: PushSubscription, notification: AvenNotification) {
  configure();
  await webpush.sendNotification(subscription, JSON.stringify(notification), { TTL: 60 * 60 });
}
