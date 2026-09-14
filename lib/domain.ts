import { z } from "zod";

export const STATE_CATEGORIES = ["progress", "blockers", "decisions", "commitments", "deadlines", "signals"] as const;

export const stateEntrySchema = z.object({
  id: z.string().optional(), text: z.string().min(1), owner: z.string().nullable().default(null),
  createdAt: z.string().optional(), updatedAt: z.string().optional(),
  dueAt: z.string().nullable().optional(),
  sourceUpdateIds: z.array(z.string()).default([]),
  status: z.enum(["active", "completed", "superseded", "resolved"]).default("active"),
});

export const teamStateSchema = z.object({
  progress: z.array(stateEntrySchema).default([]), blockers: z.array(stateEntrySchema).default([]),
  decisions: z.array(stateEntrySchema).default([]), commitments: z.array(stateEntrySchema).default([]),
  deadlines: z.array(stateEntrySchema).default([]), signals: z.array(stateEntrySchema).default([]),
});

export const attentionDraftSchema = z.object({
  type: z.enum(["blocker", "conflict", "deadline_risk", "unowned_work", "decision_required"]),
  message: z.string().min(1), severity: z.enum(["low", "medium", "high", "critical"]),
  sourceUpdateIds: z.array(z.string()).default([]),
});

const calendarActionMetadata = {
  confidence: z.number().min(0).max(1),
  sourceUpdateIds: z.array(z.string()).default([]),
};

export const calendarActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"), title: z.string().min(1), startsAt: z.string(),
    endsAt: z.string().nullable().default(null), description: z.string().optional(),
    ...calendarActionMetadata,
  }),
  z.object({
    action: z.literal("update"), eventId: z.string().min(1), title: z.string().min(1).optional(),
    startsAt: z.string().optional(), endsAt: z.string().nullable().optional(), description: z.string().optional(),
    ...calendarActionMetadata,
  }),
  z.object({
    action: z.literal("delete"), eventId: z.string().min(1),
    ...calendarActionMetadata,
  }),
]);

export const reconciliationSchema = z.object({
  stateChanges: z.array(z.object({
    operation: z.enum(["add", "update", "supersede", "resolve"]), category: z.enum(STATE_CATEGORIES),
    summary: z.string().min(1), sourceUpdateIds: z.array(z.string()).default([]),
  })).default([]),
  newState: teamStateSchema,
  attentionItems: z.array(attentionDraftSchema).default([]),
  calendarActions: z.array(calendarActionSchema).default([]),
});

export type TeamState = z.infer<typeof teamStateSchema>;
export type Reconciliation = z.infer<typeof reconciliationSchema>;
export type VoiceUpdateStatus = "queued" | "processing" | "processed" | "failed";
export type VoiceUpdate = {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  status: VoiceUpdateStatus;
  processingStartedAt: string | null;
  processedAt: string | null;
  processingError: string | null;
};
export const EMPTY_TEAM_STATE: TeamState = { progress: [], blockers: [], decisions: [], commitments: [], deadlines: [], signals: [] };
