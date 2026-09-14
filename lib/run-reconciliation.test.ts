import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_TEAM_STATE } from "./domain";

const db = vi.hoisted(() => ({
  claimPendingUpdates: vi.fn(),
  getLatestState: vi.fn(),
  releaseUpdates: vi.fn(),
  saveReconciliation: vi.fn(),
}));
const reconcileTeamState = vi.hoisted(() => vi.fn());
const google = vi.hoisted(() => ({
  executeManagedCalendarActions: vi.fn(),
  listManagedCalendarEvents: vi.fn(),
  loadTeamGoogleSession: vi.fn(),
  storeTeamGoogleSession: vi.fn(),
}));

vi.mock("./db", () => db);
vi.mock("./reconcile", () => ({ reconcileTeamState }));
vi.mock("./integrations/google-calendar", () => ({
  executeManagedCalendarActions: google.executeManagedCalendarActions,
  listManagedCalendarEvents: google.listManagedCalendarEvents,
}));
vi.mock("./integrations/google-session", () => ({
  loadTeamGoogleSession: google.loadTeamGoogleSession,
  storeTeamGoogleSession: google.storeTeamGoogleSession,
}));

import { runReconciliation } from "./run-reconciliation";

const state = { version: 0, state: EMPTY_TEAM_STATE, createdAt: "1970-01-01T00:00:00.000Z" };
const update = {
  id: "update-1", teamId: "team-1", userId: "user-1", userName: "Alex Morgan", text: "Launch is ready",
  createdAt: "2026-09-14T10:00:00.000Z", status: "processing" as const,
  processingStartedAt: "2026-09-14T10:01:00.000Z", processedAt: null, processingError: null,
};
const result = { stateChanges: [], newState: EMPTY_TEAM_STATE, attentionItems: [], calendarActions: [] };

describe("runReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getLatestState.mockResolvedValue(state);
    google.loadTeamGoogleSession.mockResolvedValue(null);
  });

  it("does not invoke the agent when the window has no claimable batch", async () => {
    db.claimPendingUpdates.mockResolvedValue(null);

    await expect(runReconciliation("team-1")).resolves.toEqual({ processed: 0, state });
    expect(reconcileTeamState).not.toHaveBeenCalled();
  });

  it("saves a claimed batch using the same concurrency token", async () => {
    db.claimPendingUpdates.mockResolvedValue({ claimId: "claim-1", updates: [update] });
    reconcileTeamState.mockResolvedValue(result);
    db.saveReconciliation.mockResolvedValue({ ...state, version: 1 });

    await expect(runReconciliation("team-1")).resolves.toMatchObject({ processed: 1 });
    expect(db.saveReconciliation).toHaveBeenCalledWith("team-1", ["update-1"], "claim-1", result);
  });

  it("uses the managed calendar as agent context and executes returned actions", async () => {
    const session = { tokens: { access_token: "old", expires_at: 1 }, managedCalendarId: "aven-calendar" };
    const refreshedTokens = { access_token: "fresh", expires_at: 2 };
    const finalTokens = { access_token: "final", expires_at: 3 };
    const calendarActions = [{
      action: "create" as const, title: "Launch", startsAt: "2026-09-15T10:00:00.000Z",
      endsAt: null, confidence: 1, sourceUpdateIds: ["update-1"],
    }];
    db.claimPendingUpdates.mockResolvedValue({ claimId: "claim-1", updates: [update] });
    google.loadTeamGoogleSession.mockResolvedValue(session);
    google.listManagedCalendarEvents.mockResolvedValue({ events: [{ id: "event-1" }], tokens: refreshedTokens });
    reconcileTeamState.mockResolvedValue({ ...result, calendarActions });
    db.saveReconciliation.mockResolvedValue({ ...state, version: 1 });
    google.executeManagedCalendarActions.mockResolvedValue({ results: [], tokens: finalTokens });

    await runReconciliation("team-1");

    expect(reconcileTeamState).toHaveBeenCalledWith(state.state, [update], [{ id: "event-1" }]);
    expect(google.executeManagedCalendarActions).toHaveBeenCalledWith(refreshedTokens, "aven-calendar", calendarActions);
    expect(google.storeTeamGoogleSession).toHaveBeenLastCalledWith("team-1", { ...session, tokens: finalTokens });
  });

  it("releases a failed batch with its claim token so it remains retryable", async () => {
    const failure = new Error("agent unavailable");
    db.claimPendingUpdates.mockResolvedValue({ claimId: "claim-1", updates: [update] });
    reconcileTeamState.mockRejectedValue(failure);

    await expect(runReconciliation("team-1")).rejects.toThrow("agent unavailable");
    expect(db.releaseUpdates).toHaveBeenCalledWith(["update-1"], "claim-1", failure);
    expect(db.saveReconciliation).not.toHaveBeenCalled();
  });
});
