import { describe, expect, it } from "vitest";
import { isReconciliationDue } from "./reconciliation-window";

const completedAt = "2026-09-14T10:00:00.000Z";

describe("isReconciliationDue", () => {
  it("runs the first pending update immediately when the team is idle", () => {
    expect(isReconciliationDue(null, true, false, new Date("2026-09-14T10:12:00.000Z"))).toBe(true);
  });

  it("queues updates until five minutes after the last completed run", () => {
    expect(isReconciliationDue(completedAt, true, false, new Date("2026-09-14T10:04:59.999Z"))).toBe(false);
    expect(isReconciliationDue(completedAt, true, false, new Date("2026-09-14T10:05:00.000Z"))).toBe(true);
  });

  it("does not run without pending updates or while another run is active", () => {
    expect(isReconciliationDue(completedAt, false, false, new Date("2026-09-14T10:12:00.000Z"))).toBe(false);
    expect(isReconciliationDue(completedAt, true, true, new Date("2026-09-14T10:12:00.000Z"))).toBe(false);
  });
});
