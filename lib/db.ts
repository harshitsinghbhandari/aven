import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { EMPTY_TEAM_STATE, type Reconciliation, type TeamState, type VoiceUpdate } from "./domain";
import { isReconciliationDue } from "./reconciliation-window";

export type AttentionItem = { id: string; type: string; message: string; severity: string; status: string; sourceUpdateIds: string[]; createdAt: string };
export type StateSnapshot = { version: number; state: TeamState; createdAt: string };
export type TeamRecord = {
  id: string;
  name: string;
  activeWindowEndsAt: string | null;
  nextReconciliationAt: string | null;
  isProcessing: boolean;
};
export type TeamMember = { id: string; name: string; email: string; role: "owner" | "member" };
export type ClaimedUpdates = { claimId: string; updates: VoiceUpdate[] };
export type TeamGoogleSession = { encryptedSessionToken: string; updatedAt: string };

let client: ReturnType<typeof postgres> | undefined;
function sql() { client ??= postgres(config.databaseUrl(), { max: 5, prepare: false }); return client; }

export async function createVoiceUpdate(teamId: string, userId: string, text: string): Promise<VoiceUpdate> {
  const [update] = await sql()<VoiceUpdate[]>`
    INSERT INTO voice_updates (team_id, user_id, text)
    SELECT ${teamId}::uuid, ${userId}::uuid, ${text}
    FROM memberships WHERE team_id = ${teamId}::uuid AND user_id = ${userId}::uuid
    RETURNING id, team_id AS "teamId", user_id AS "userId", text, created_at AS "createdAt",
      (SELECT name FROM users WHERE id = user_id) AS "userName", 'queued' AS status,
      processing_started_at AS "processingStartedAt", processed_at AS "processedAt",
      processing_error AS "processingError"`;
  if (!update) throw new Error("User is not a member of this team");
  return update;
}

export async function listUpdates(teamId: string, limit = 50): Promise<VoiceUpdate[]> {
  return sql()<VoiceUpdate[]>`
    SELECT v.id, v.team_id AS "teamId", v.user_id AS "userId", u.name AS "userName", v.text, v.created_at AS "createdAt",
      CASE
        WHEN v.processed_at IS NOT NULL THEN 'processed'
        WHEN v.processing_started_at IS NOT NULL THEN 'processing'
        WHEN v.processing_error IS NOT NULL THEN 'failed'
        ELSE 'queued'
      END AS status,
      v.processing_started_at AS "processingStartedAt", v.processed_at AS "processedAt",
      v.processing_error AS "processingError"
    FROM voice_updates v JOIN users u ON u.id = v.user_id WHERE v.team_id = ${teamId}
    ORDER BY v.created_at DESC LIMIT ${limit}`;
}

export async function getLatestState(teamId: string): Promise<StateSnapshot> {
  const [snapshot] = await sql()<StateSnapshot[]>`
    SELECT version, state_json AS state, created_at AS "createdAt" FROM team_states
    WHERE team_id = ${teamId} ORDER BY version DESC LIMIT 1`;
  if (!snapshot) return { version: 0, state: EMPTY_TEAM_STATE, createdAt: new Date(0).toISOString() };
  const state = { ...snapshot.state };
  for (const category of Object.keys(EMPTY_TEAM_STATE) as Array<keyof TeamState>) {
    const seen = new Set<string>();
    state[category] = state[category].filter((entry) => {
      const key = `${entry.text.trim().toLocaleLowerCase()}|${entry.owner?.trim().toLocaleLowerCase() ?? ""}|${entry.dueAt ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  return { ...snapshot, state };
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
      CASE
        WHEN activity_window_started_at + INTERVAL '5 minutes' > NOW()
          THEN activity_window_started_at + INTERVAL '5 minutes'
        ELSE NULL
      END AS "activeWindowEndsAt",
      CASE
        WHEN EXISTS (SELECT 1 FROM voice_updates WHERE team_id = teams.id AND processed_at IS NULL)
          THEN GREATEST(COALESCE(activity_window_started_at + INTERVAL '5 minutes', NOW()), NOW())
        ELSE NULL
      END AS "nextReconciliationAt",
      EXISTS (
        SELECT 1 FROM voice_updates WHERE team_id = teams.id AND processed_at IS NULL
          AND processing_started_at >= NOW() - INTERVAL '10 minutes'
      ) AS "isProcessing"
    FROM teams WHERE id = ${teamId}`;
  return team ?? null;
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  return sql()<TeamMember[]>`
    SELECT u.id, u.name, u.email, m.role FROM memberships m
    JOIN users u ON u.id = m.user_id WHERE m.team_id = ${teamId}
    ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, u.name ASC`;
}

export async function getTeamGoogleSession(teamId: string): Promise<TeamGoogleSession | null> {
  const [session] = await sql()<TeamGoogleSession[]>`
    SELECT encrypted_session_token AS "encryptedSessionToken", updated_at AS "updatedAt"
    FROM team_google_sessions WHERE team_id = ${teamId}`;
  return session ?? null;
}

export async function saveTeamGoogleSession(teamId: string, encryptedSessionToken: string): Promise<void> {
  await sql()`
    INSERT INTO team_google_sessions (team_id, encrypted_session_token)
    VALUES (${teamId}, ${encryptedSessionToken})
    ON CONFLICT (team_id) DO UPDATE
    SET encrypted_session_token = EXCLUDED.encrypted_session_token, updated_at = NOW()`;
}

export async function deleteTeamGoogleSession(teamId: string): Promise<boolean> {
  const deleted = await sql()<Array<{ teamId: string }>>`
    DELETE FROM team_google_sessions WHERE team_id = ${teamId}
    RETURNING team_id AS "teamId"`;
  return deleted.length > 0;
}

export async function claimPendingUpdates(teamId: string): Promise<ClaimedUpdates | null> {
  return sql().begin(async (tx) => {
    const [team] = await tx<Array<{ activityWindowStartedAt: string | null }>>`
      SELECT activity_window_started_at AS "activityWindowStartedAt"
      FROM teams WHERE id = ${teamId} FOR UPDATE`;
    if (!team) return null;

    const [pending] = await tx<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM voice_updates
      WHERE team_id = ${teamId} AND processed_at IS NULL`;
    if (!pending?.count) return null;

    const [active] = await tx<Array<{ active: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM voice_updates WHERE team_id = ${teamId} AND processed_at IS NULL
          AND processing_started_at >= NOW() - INTERVAL '10 minutes'
      ) AS active`;
    if (!isReconciliationDue(team.activityWindowStartedAt, true, Boolean(active?.active))) return null;

    const updates = await tx<VoiceUpdate[]>`
      SELECT v.id, v.team_id AS "teamId", v.user_id AS "userId", u.name AS "userName", v.text, v.created_at AS "createdAt",
        'processing' AS status, NOW() AS "processingStartedAt", NULL AS "processedAt", NULL AS "processingError"
      FROM voice_updates v JOIN users u ON u.id = v.user_id
      WHERE v.team_id = ${teamId} AND v.processed_at IS NULL
      ORDER BY v.created_at ASC FOR UPDATE OF v SKIP LOCKED`;
    if (!updates.length) return null;
    const claimId = randomUUID();
    await tx`UPDATE voice_updates SET processing_started_at = NOW(), processing_claim_id = ${claimId}, processing_error = NULL
      WHERE id = ANY(${updates.map((update) => update.id)}::uuid[])`;
    return { claimId, updates };
  });
}

export async function releaseUpdates(updateIds: string[], claimId: string, error: unknown): Promise<void> {
  if (!updateIds.length) return;
  const message = error instanceof Error ? error.message : "Unknown reconciliation error";
  await sql()`UPDATE voice_updates
    SET processing_started_at = NULL, processing_claim_id = NULL, processing_error = ${message.slice(0, 1000)}
    WHERE id = ANY(${updateIds}::uuid[]) AND processing_claim_id = ${claimId}`;
}

export async function saveReconciliation(teamId: string, updateIds: string[], claimId: string, result: Reconciliation): Promise<StateSnapshot> {
  return sql().begin(async (tx) => {
    await tx`SELECT id FROM teams WHERE id = ${teamId} FOR UPDATE`;
    const ownedUpdates = await tx<Array<{ id: string }>>`
      SELECT id FROM voice_updates
      WHERE id = ANY(${updateIds}::uuid[]) AND team_id = ${teamId}
        AND processed_at IS NULL AND processing_claim_id = ${claimId}
      FOR UPDATE`;
    if (ownedUpdates.length !== updateIds.length) throw new Error("Reconciliation claim is no longer active");
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
        SELECT ${teamId}, ${run.id}, ${item.type}, ${item.message}, ${item.severity}, ${item.sourceUpdateIds}::uuid[]
        WHERE NOT EXISTS (
          SELECT 1 FROM attention_items
          WHERE team_id = ${teamId} AND status = 'open' AND type = ${item.type} AND lower(trim(message)) = lower(trim(${item.message}))
        )`;
    }
    await tx`UPDATE voice_updates
      SET processed_at = NOW(), processing_started_at = NULL, processing_claim_id = NULL, processing_error = NULL
      WHERE id = ANY(${updateIds}::uuid[]) AND processing_claim_id = ${claimId}`;
    await tx`UPDATE teams SET activity_window_started_at = NOW() WHERE id = ${teamId}`;
    return snapshot;
  });
}
