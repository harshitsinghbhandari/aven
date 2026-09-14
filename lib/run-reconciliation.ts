import { claimPendingUpdates, getLatestState, releaseUpdates, saveReconciliation } from "./db";
import { executeManagedCalendarActions, listManagedCalendarEvents } from "./integrations/google-calendar";
import { loadTeamGoogleSession, storeTeamGoogleSession } from "./integrations/google-session";
import { reconcileTeamState } from "./reconcile";

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
    const result = await reconcileTeamState(previous.state, claim.updates, calendar?.events ?? []);
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
