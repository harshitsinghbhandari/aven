# Aven submission scope

## Intent, stated cleanly

Aven must demonstrate a real voice to operational memory loop. Harshit sends an update through his privately configured iPhone Shortcut. Aven transcribes it immediately, stores and displays the transcript, batches nearby updates, reconciles them into live team state, and automatically maintains relevant events in a dedicated Google Calendar. The public product opens directly into a generic organization without login, uses database backed data rather than frontend fixtures, and remains usable as a hackathon demonstration without exposing working voice capture credentials to visitors.

## Core live flow

1. Harshit records an update through an already configured private iPhone Shortcut.
2. The capture endpoint verifies the member credential, sends audio to Groq, stores the transcript, and returns promptly.
3. The transcript appears in the voice stream immediately with a queued or processing status.
4. The existing dashboard remains visible during reconciliation. It does not show a blocking loading state.
5. When reconciliation finishes, the dashboard adopts the new structured state on its next automatic refresh.
6. The browser checks for new transcripts and state once per minute. Manual refresh remains available.
7. If live data cannot load, the interface shows an honest error or empty state. It never substitutes realistic hardcoded operational data.

## Reconciliation timing

Reconciliation uses a rolling five minute activity window anchored to the last completed run.

If a run completes at time T, messages arriving before T plus five minutes remain queued. At T plus five minutes, all queued messages are reconciled together and the next five minute window begins.

If no messages are queued when the window expires, no agent run occurs and the team becomes idle. The first message arriving after that idle point is reconciled immediately. Completion of that run starts a fresh five minute window.

Only new, unprocessed messages enter a run. Concurrent or failed runs must not lose transcripts or process the same batch twice. Failed messages remain retryable.

## Dashboard and organization

The public application opens the default generic organization directly. No login is required for the submission build.

The organization surface includes:

1. Organization name and basic information.
2. Members loaded from the database using generic names.
3. An Add member control that may be visibly unavailable or marked as coming later.
4. Navigation for organization and account concepts where useful, without pretending those unfinished flows work.

The dashboard loads real transcripts, reconciliation state, attention items, activity status, and timestamps from the backend. Basic labels, explanatory copy, empty states, and generic organization metadata may be fixed. Team updates, listening windows, owners, counts, deadlines, and personalized identity must not come from frontend demo fixtures.

The Shortcut setup surface is publicly viewable without an access code so evaluators can understand the flow. It must not reveal a valid capture credential. Harshit's working Shortcut is configured privately outside the public visitor flow.

## Google Calendar

Google Calendar is required for the submission build.

The user connects a Google account and chooses where Aven should create its dedicated calendar. Aven creates or reuses a calendar named Aven and records its identity. Agent derived calendar actions execute directly without confirmation.

Aven may create, update, and delete events inside the dedicated Aven calendar. It must not mutate events in any other calendar. Calendar color coding is desirable but deferred until the core flow works.

## What it is and what it is not

In scope:

1. Real Groq transcription.
2. Durable transcripts with queued, processing, processed, and failed lifecycle states.
3. The five minute rolling reconciliation behavior.
4. Real Strands reconciliation against current team state.
5. A live dashboard backed by PostgreSQL.
6. Public generic organization and member views.
7. Private presenter voice capture.
8. A dedicated Aven Google Calendar with automatic event creation, updates, and deletion.
9. Honest loading, empty, queued, processing, and failure states.

Explicitly out of scope:

1. Real user login or signup.
2. Multi tenant authorization.
3. Working member invitations or member creation.
4. Publicly usable voice capture.
5. Calendar color coding unless time remains.
6. Notification delivery unless time remains after the core flow is verified.
7. A polished demo mode separate from the real default organization.

## Assumptions surfaced and confirmed

1. Submission credibility comes from one complete real workflow, not broad account management.
2. Public visitors may inspect the generic organization but cannot submit voice updates.
3. One minute browser refresh latency is acceptable.
4. The dashboard should never disappear or block while reconciliation runs.
5. Calendar actions are trusted to execute automatically, but only inside the dedicated Aven calendar.
6. Fixed interface copy is acceptable. Fixed operational state presented as live is not.

## Alternatives considered and rejected

1. A one hour reconciliation window was rejected because it is too slow for the product demonstration.
2. Reconciliation on every message was rejected in favor of immediate processing after idle plus five minute batching during activity.
3. A private setup code blocking the entire Shortcut explanation was rejected because evaluators need to see the flow.
4. Full authentication and organization onboarding were rejected for this submission because they do not prove the core product loop.
5. Human confirmation for Calendar actions was rejected in favor of direct execution inside the isolated Aven calendar.
6. Hardcoded dashboard fixtures were rejected because they conceal backend failures and make the product appear fake.

## Small calls deferred

1. Exact wording and disabled state for Add member.
2. Exact organization and account navigation labels.
3. Calendar colors.
4. Notifications after the core workflow is working.
