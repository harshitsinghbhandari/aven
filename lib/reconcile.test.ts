import { describe, expect, it } from "vitest";
import { EMPTY_TEAM_STATE, type Reconciliation } from "./domain";
import { normalizeReconciliation } from "./reconcile";

describe("normalizeReconciliation", () => {
  it("assigns application IDs, keeps valid sources, and drops unsafe calendar actions", () => {
    const result: Reconciliation = {
      stateChanges: [],
      newState: { ...EMPTY_TEAM_STATE, progress: [{ text: "Onboarding fixed", owner: "Harshit", sourceUpdateIds: ["update-1", "invented"], status: "completed" }] },
      attentionItems: [],
      calendarActions: [{ action: "create", title: "Maybe meet", startsAt: "2026-09-15T10:00:00Z", endsAt: null, confidence: 0.7, sourceUpdateIds: ["update-1"] }],
    };
    const normalized = normalizeReconciliation(result, EMPTY_TEAM_STATE, [{ id: "update-1", teamId: "team", userId: "user", userName: "Harshit", text: "I fixed onboarding", createdAt: "2026-09-14T10:00:00Z" }], new Date("2026-09-14T11:00:00Z"));
    expect(normalized.newState.progress[0]).toMatchObject({ text: "Onboarding fixed", sourceUpdateIds: ["update-1"], createdAt: "2026-09-14T11:00:00.000Z" });
    expect(normalized.newState.progress[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalized.calendarActions).toEqual([]);
  });
});
