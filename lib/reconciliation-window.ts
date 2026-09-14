export const RECONCILIATION_WINDOW_MS = 5 * 60 * 1000;

export function isReconciliationDue(
  activityWindowStartedAt: string | Date | null,
  hasPendingUpdates: boolean,
  hasActiveRun: boolean,
  now = new Date(),
): boolean {
  if (!hasPendingUpdates || hasActiveRun) return false;
  if (!activityWindowStartedAt) return true;
  return new Date(activityWindowStartedAt).getTime() + RECONCILIATION_WINDOW_MS <= now.getTime();
}
