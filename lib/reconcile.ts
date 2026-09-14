import { randomUUID } from "node:crypto";
import { Agent, BedrockModel } from "@strands-agents/sdk";
import { config } from "./config";
import { reconciliationSchema, STATE_CATEGORIES, type Reconciliation, type TeamState, type VoiceUpdate } from "./domain";

const SYSTEM_PROMPT = `You are Aven, the operational memory for a small team. Reconcile new spoken updates against existing state.
Preserve relevant history. Mark obsolete entries superseded or resolved instead of deleting them. Treat the named speaker as the subject of first person statements. Record facts only when supported by update IDs. Detect blockers, contradictions, deadline risk, unowned urgent work, and decisions that need a human. Most updates require no attention item. Resolve relative dates such as today, tomorrow, or in three days against currentTime. Whenever a new update creates or changes a commitment or deadline with a dueAt, you MUST emit a matching calendar create or update action with the same sourceUpdateIds. Calendar actions require a concrete date or time and confidence of at least 0.9. Create events for new dated commitments even when no clock time is provided, using the resolved date and the default event duration. Use event IDs from calendar context when updating or deleting existing events. Never invent an event ID. Return the complete new state through the required structured output schema.`;

function normalize(result: Reconciliation, previous: TeamState, updates: VoiceUpdate[], now = new Date()): Reconciliation {
  const validSources = new Set(updates.map((update) => update.id));
  const oldEntries = new Map(STATE_CATEGORIES.flatMap((category) => previous[category].map((entry) => [entry.id, entry] as const)));
  const timestamp = now.toISOString();
  const newState = { ...result.newState };
  for (const category of STATE_CATEGORIES) {
    const entries = result.newState[category].map((entry) => {
      const old = entry.id ? oldEntries.get(entry.id) : undefined;
      return {
        ...entry,
        id: old?.id ?? randomUUID(),
        owner: entry.owner ?? null,
        createdAt: old?.createdAt ?? entry.createdAt ?? timestamp,
        updatedAt: timestamp,
        sourceUpdateIds: [...new Set(entry.sourceUpdateIds.filter((id) => validSources.has(id) || old?.sourceUpdateIds.includes(id)))],
      };
    });
    const deduped = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
      const key = `${entry.text.trim().toLocaleLowerCase()}|${entry.owner?.trim().toLocaleLowerCase() ?? ""}|${entry.dueAt ?? ""}`;
      const existing = deduped.get(key);
      if (!existing) deduped.set(key, entry);
      else deduped.set(key, { ...existing, sourceUpdateIds: [...new Set([...existing.sourceUpdateIds, ...entry.sourceUpdateIds])], updatedAt: timestamp });
    }
    newState[category] = [...deduped.values()];
  }
  return {
    ...result,
    newState,
    attentionItems: result.attentionItems.map((item) => ({ ...item, sourceUpdateIds: item.sourceUpdateIds.filter((id) => validSources.has(id)) })),
    calendarActions: result.calendarActions.filter((action) => action.confidence >= 0.9).map((action) => ({ ...action, sourceUpdateIds: action.sourceUpdateIds.filter((id) => validSources.has(id)) })),
  };
}

export async function reconcileTeamState(previous: TeamState, updates: VoiceUpdate[], calendarContext: unknown = []): Promise<Reconciliation> {
  const model = new BedrockModel({ region: config.awsRegion(), modelId: config.bedrockModelId(), temperature: 0, maxTokens: 6000 });
  const agent = new Agent({ model, systemPrompt: SYSTEM_PROMPT, structuredOutputSchema: reconciliationSchema, printer: false });
  const input = JSON.stringify({ currentTime: new Date().toISOString(), existingTeamState: previous, newVoiceUpdates: updates, relevantCalendarContext: calendarContext });
  const response = await agent.invoke(input, { limits: { turns: 3 } });
  const parsed = reconciliationSchema.parse(response.structuredOutput);
  return normalize(parsed, previous, updates);
}

export { normalize as normalizeReconciliation };
