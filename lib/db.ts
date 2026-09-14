import postgres from "postgres";
import { config } from "./config";
import { EMPTY_TEAM_STATE, type Reconciliation, type TeamState, type VoiceUpdate } from "./domain";

export type VoiceNote = { id: string; text: string; createdAt: string };
export type AttentionItem = { id: string; type: string; message: string; severity: string; status: string; sourceUpdateIds: string[]; createdAt: string };
export type StateSnapshot = { version: number; state: TeamState; createdAt: string };
export type TeamRecord = { id: string; name: string; activeWindowEndsAt: string | null };

let client: ReturnType<typeof postgres> | undefined;
function sql() { client ??= postgres(config.databaseUrl(), { max: 5, prepare: false }); return client; }

export async function createNote(text: string): Promise<VoiceNote> {
  const [note] = await sql()<VoiceNote[]>`INSERT INTO voice_notes (text) VALUES (${text}) RETURNING id, text, created_at AS "createdAt"`;
  return note;
}
export async function listPendingNotes(): Promise<VoiceNote[]> {
  return sql()<VoiceNote[]>`SELECT id, text, created_at AS "createdAt" FROM voice_notes WHERE delivered_at IS NULL ORDER BY created_at ASC`;
}
export async function acknowledgeNote(id: string): Promise<boolean> {
  const rows = await sql()<Array<{ id: string }>>`UPDATE voice_notes SET delivered_at = COALESCE(delivered_at, NOW()) WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function createVoiceUpdate(teamId: string, userId: string, text: string): Promise<VoiceUpdate> {
  const [update] = await sql()<VoiceUpdate[]>`
    INSERT INTO voice_updates (team_id, user_id, text)
    SELECT ${teamId}::uuid, ${userId}::uuid, ${text}
    FROM memberships WHERE team_id = ${teamId}::uuid AND user_id = ${userId}::uuid
    RETURNING id, team_id AS "teamId", user_id AS "userId", text, created_at AS "createdAt",
      (SELECT name FROM users WHERE id = user_id) AS "userName"`;
  if (!update) throw new Error("User is not a member of this team");
  return update;
}

export async function listUpdates(teamId: string, limit = 50): Promise<VoiceUpdate[]> {
  return sql()<VoiceUpdate[]>`
    SELECT v.id, v.team_id AS "teamId", v.user_id AS "userId", u.name AS "userName", v.text, v.created_at AS "createdAt"
    FROM voice_updates v JOIN users u ON u.id = v.user_id WHERE v.team_id = ${teamId}
    ORDER BY v.created_at DESC LIMIT ${limit}`;
}

export async function getLatestState(teamId: string): Promise<StateSnapshot> {
  const [snapshot] = await sql()<StateSnapshot[]>`
    SELECT version, state_json AS state, created_at AS "createdAt" FROM team_states
    WHERE team_id = ${teamId} ORDER BY version DESC LIMIT 1`;
  return snapshot ?? { version: 0, state: EMPTY_TEAM_STATE, createdAt: new Date(0).toISOString() };
}

export async function listAttention(teamId: string): Promise<AttentionItem[]> {
  return sql()<AttentionItem[]>`
    SELECT id, type, message, severity, status, source_update_ids AS "sourceUpdateIds", created_at AS "createdAt"
    FROM attention_items WHERE team_id = ${teamId} AND status = 'open'
    ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at DESC`;
}

export async function getTeam(teamId: string): Promise<TeamRecord | null> {
  const [team] = await sql()<TeamRecord[]>`
    SELECT id, name,
      CASE WHEN activity_window_started_at IS NULL THEN NULL ELSE activity_window_started_at + INTERVAL '1 hour' END AS "activeWindowEndsAt"
    FROM teams WHERE id = ${teamId}`;
  return team ?? null;
}

export async function claimPendingUpdates(teamId: string): Promise<VoiceUpdate[]> {
  return sql().begin(async (tx) => {
    const updates = await tx<VoiceUpdate[]>`
      SELECT v.id, v.team_id AS "teamId", v.user_id AS "userId", u.name AS "userName", v.text, v.created_at AS "createdAt"
      FROM voice_updates v JOIN users u ON u.id = v.user_id
      WHERE v.team_id = ${teamId} AND v.processed_at IS NULL
        AND (v.processing_started_at IS NULL OR v.processing_started_at < NOW() - INTERVAL '10 minutes')
      ORDER BY v.created_at ASC FOR UPDATE OF v SKIP LOCKED`;
    if (updates.length) await tx`UPDATE voice_updates SET processing_started_at = NOW(), processing_error = NULL WHERE id = ANY(${updates.map((u) => u.id)}::uuid[])`;
    return updates;
  });
}

export async function releaseUpdates(updateIds: string[], error: unknown): Promise<void> {
  if (!updateIds.length) return;
  const message = error instanceof Error ? error.message : "Unknown reconciliation error";
  await sql()`UPDATE voice_updates SET processing_started_at = NULL, processing_error = ${message.slice(0, 1000)} WHERE id = ANY(${updateIds}::uuid[])`;
}

export async function saveReconciliation(teamId: string, updateIds: string[], result: Reconciliation): Promise<StateSnapshot> {
  return sql().begin(async (tx) => {
    await tx`SELECT id FROM teams WHERE id = ${teamId} FOR UPDATE`;
    const [latest] = await tx<Array<{ version: number }>>`SELECT version FROM team_states WHERE team_id = ${teamId} ORDER BY version DESC LIMIT 1`;
    const version = (latest?.version ?? 0) + 1;
    const [snapshot] = await tx<StateSnapshot[]>`
      INSERT INTO team_states (team_id, version, state_json) VALUES (${teamId}, ${version}, ${tx.json(result.newState)})
      RETURNING version, state_json AS state, created_at AS "createdAt"`;
    const [run] = await tx<Array<{ id: string }>>`
      INSERT INTO reconciliation_runs (team_id, state_version, update_ids, state_changes, calendar_actions)
      VALUES (${teamId}, ${version}, ${updateIds}::uuid[], ${tx.json(result.stateChanges)}, ${tx.json(result.calendarActions)}) RETURNING id`;
    for (const item of result.attentionItems) {
      await tx`INSERT INTO attention_items (team_id, run_id, type, message, severity, source_update_ids)
        VALUES (${teamId}, ${run.id}, ${item.type}, ${item.message}, ${item.severity}, ${item.sourceUpdateIds}::uuid[])`;
    }
    await tx`UPDATE voice_updates SET processed_at = NOW(), processing_started_at = NULL WHERE id = ANY(${updateIds}::uuid[])`;
    await tx`UPDATE teams SET activity_window_started_at = COALESCE(activity_window_started_at, NOW()) WHERE id = ${teamId}`;
    return snapshot;
  });
}
