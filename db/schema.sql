CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  email TEXT NOT NULL UNIQUE CHECK (length(trim(email)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  activity_window_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_google_sessions (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  encrypted_session_token TEXT NOT NULL CHECK (length(trim(encrypted_session_token)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processing_claim_id UUID,
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

ALTER TABLE voice_updates ADD COLUMN IF NOT EXISTS processing_claim_id UUID;

CREATE INDEX IF NOT EXISTS voice_updates_pending_idx ON voice_updates (team_id, created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS voice_updates_processing_idx ON voice_updates (team_id, processing_started_at) WHERE processed_at IS NULL AND processing_started_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS team_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, version)
);

CREATE INDEX IF NOT EXISTS team_states_latest_idx ON team_states (team_id, version DESC);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  state_version INTEGER NOT NULL,
  update_ids UUID[] NOT NULL,
  state_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  calendar_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attention_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  run_id UUID REFERENCES reconciliation_runs(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('blocker', 'conflict', 'deadline_risk', 'unowned_work', 'decision_required')),
  message TEXT NOT NULL CHECK (length(trim(message)) > 0),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  source_update_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS attention_items_open_idx ON attention_items (team_id, created_at DESC) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS voice_notes_pending_idx ON voice_notes (created_at) WHERE delivered_at IS NULL;
