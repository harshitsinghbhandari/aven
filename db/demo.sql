BEGIN;
INSERT INTO teams (id, name, activity_window_started_at) VALUES ('a0000000-0000-4000-8000-000000000001', 'Aven Demo Team', NOW() - INTERVAL '20 minutes') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, activity_window_started_at = EXCLUDED.activity_window_started_at;
INSERT INTO users (id, name, email) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Harshit', 'harshit@aven.demo'),
  ('b0000000-0000-4000-8000-000000000002', 'Ayush', 'ayush@aven.demo'),
  ('b0000000-0000-4000-8000-000000000003', 'Rahul', 'rahul@aven.demo')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO memberships (team_id, user_id, role) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'owner'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'member'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'member')
ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO voice_updates (id, team_id, user_id, text, created_at, processed_at) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'I finished the onboarding fix.', NOW() - INTERVAL '28 minutes', NOW() - INTERVAL '15 minutes'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Do not deploy yet. The database migration still needs my review.', NOW() - INTERVAL '24 minutes', NOW() - INTERVAL '15 minutes'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'We are dropping CSV export from this release.', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '15 minutes'),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'I am still working on CSV export and should have it ready tomorrow.', NOW() - INTERVAL '17 minutes', NOW() - INTERVAL '15 minutes'),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Investor demo is tomorrow at 2 PM.', NOW() - INTERVAL '14 minutes', NOW() - INTERVAL '12 minutes')
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, created_at = EXCLUDED.created_at, processed_at = EXCLUDED.processed_at;
INSERT INTO team_states (id, team_id, version, state_json) VALUES ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1,
  jsonb_build_object(
    'progress', jsonb_build_array(jsonb_build_object('id','e0000000-0000-4000-8000-000000000001','text','Onboarding fix completed','owner','Harshit','createdAt',NOW() - INTERVAL '28 minutes','updatedAt',NOW() - INTERVAL '12 minutes','sourceUpdateIds',jsonb_build_array('c0000000-0000-4000-8000-000000000001'),'status','completed')),
    'blockers', jsonb_build_array(jsonb_build_object('id','e0000000-0000-4000-8000-000000000002','text','Deployment is waiting for database migration review','owner','Ayush','createdAt',NOW() - INTERVAL '24 minutes','updatedAt',NOW() - INTERVAL '12 minutes','sourceUpdateIds',jsonb_build_array('c0000000-0000-4000-8000-000000000002'),'status','active')),
    'decisions', jsonb_build_array(jsonb_build_object('id','e0000000-0000-4000-8000-000000000003','text','CSV export removed from the current release','owner',NULL,'createdAt',NOW() - INTERVAL '20 minutes','updatedAt',NOW() - INTERVAL '12 minutes','sourceUpdateIds',jsonb_build_array('c0000000-0000-4000-8000-000000000003'),'status','active')),
    'commitments', jsonb_build_array(jsonb_build_object('id','e0000000-0000-4000-8000-000000000004','text','Review the database migration','owner','Ayush','createdAt',NOW() - INTERVAL '24 minutes','updatedAt',NOW() - INTERVAL '12 minutes','sourceUpdateIds',jsonb_build_array('c0000000-0000-4000-8000-000000000002'),'status','active')),
    'deadlines', jsonb_build_array(jsonb_build_object('id','e0000000-0000-4000-8000-000000000005','text','Investor demo tomorrow at 2 PM','owner',NULL,'createdAt',NOW() - INTERVAL '14 minutes','updatedAt',NOW() - INTERVAL '12 minutes','sourceUpdateIds',jsonb_build_array('c0000000-0000-4000-8000-000000000005'),'status','active')),
    'signals', '[]'::jsonb))
ON CONFLICT (team_id, version) DO UPDATE SET state_json = EXCLUDED.state_json;
INSERT INTO reconciliation_runs (id, team_id, state_version, update_ids, state_changes, calendar_actions) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, ARRAY['c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000005']::uuid[], '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO attention_items (id, team_id, run_id, type, message, severity, source_update_ids) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'conflict', 'CSV export is marked out of scope, but Rahul is still working toward shipping it tomorrow.', 'high', ARRAY['c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000004']::uuid[]),
  ('f1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deadline_risk', 'Deployment remains blocked by migration review ahead of tomorrow''s investor demo.', 'critical', ARRAY['c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000005']::uuid[])
ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, severity = EXCLUDED.severity, source_update_ids = EXCLUDED.source_update_ids;
COMMIT;
