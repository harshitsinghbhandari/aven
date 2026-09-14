import { claimPendingUpdates, getLatestState, releaseUpdates, saveReconciliation } from "./db";
import { executeManagedCalendarActions, listManagedCalendarEvents, type ManagedCalendarEvent } from "./integrations/google-calendar";
import { loadTeamGoogleSession, storeTeamGoogleSession } from "./integrations/google-session";
import { reconcileTeamState } from "./reconcile";
import type { Reconciliation } from "./domain";

function addMissingCalendarActions(result: Reconciliation, updates: { id: string }[], events: ManagedCalendarEvent[]): Reconciliation {
  const updateIds = new Set(updates.map((update) => update.id));
  const normalizeTitle = (title: string) => title.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sameDay = (left: string, right: string) => {
    const a = new Date(left); const b = new Date(right);
    return Number.isFinite(a.getTime()) && Number.isFinite(b.getTime()) && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  };
  const existingActions = new Set(result.calendarActions.filter((action) => action.action === "create").map((action) => `${normalizeTitle(action.title)}|${new Date(action.startsAt).toISOString().slice(0, 10)}`));
  const generated = [...result.newState.commitments, ...result.newState.deadlines].flatMap((entry) => {
    if (!entry.dueAt || !entry.sourceUpdateIds.some((id) => updateIds.has(id))) return [];
    const startsAt = new Date(entry.dueAt);
    if (!Number.isFinite(startsAt.getTime())) return [];
    const startsAtIso = startsAt.toISOString();
    const key = `${normalizeTitle(entry.text)}|${startsAtIso.slice(0, 10)}`;
    if (existingActions.has(key) || events.some((event) => sameDay(event.start, startsAtIso) && (normalizeTitle(event.summary) === normalizeTitle(entry.text) || normalizeTitle(event.summary).includes(normalizeTitle(entry.text)) || normalizeTitle(entry.text).includes(normalizeTitle(event.summary))))) return [];
    existingActions.add(key);
    return [{ action: "create" as const, title: entry.text, startsAt: startsAtIso, endsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(), confidence: 1, sourceUpdateIds: entry.sourceUpdateIds }];
  });
  return generated.length ? { ...result, calendarActions: [...result.calendarActions, ...generated] } : result;
}

export async function runReconciliation(teamId: string) {
  const claim = await claimPendingUpdates(teamId);
  if (!claim) return { processed: 0, state: await getLatestState(teamId) };

  const updateIds = claim.updates.map((update) => update.id);
  try {
    const previous = await getLatestState(teamId);
    const googleSession = await loadTeamGoogleSession(teamId);
    const calendar = googleSession
      ? await listManagedCalendarEvents(googleSession.tokens, googleSession.managedCalendarId)
      : null;
    if (googleSession && calendar) {
      await storeTeamGoogleSession(teamId, { ...googleSession, tokens: calendar.tokens });
    }
    const result = addMissingCalendarActions(
      await reconcileTeamState(previous.state, claim.updates, calendar?.events ?? []),
      claim.updates,
      calendar?.events ?? [],
    );
    if (googleSession && result.calendarActions.length) {
      const executed = await executeManagedCalendarActions(
        calendar?.tokens ?? googleSession.tokens,
        googleSession.managedCalendarId,
        result.calendarActions,
      );
      await storeTeamGoogleSession(teamId, { ...googleSession, tokens: executed.tokens });
    }
    const state = await saveReconciliation(teamId, updateIds, claim.claimId, result);
    return {
      processed: claim.updates.length,
      state,
      stateChanges: result.stateChanges,
      attentionItems: result.attentionItems,
      calendarActions: result.calendarActions,
    };
  } catch (error) {
    await releaseUpdates(updateIds, claim.claimId, error);
    throw error;
  }
}
