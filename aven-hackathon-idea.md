# Aven

## 1. Product Summary

Aven is a voice-native operational memory for small teams.

Team members speak short updates throughout the day. Aven collects those updates, understands what changed, reconciles them with existing team state, and maintains a continuously updated view of:

* progress
* blockers
* decisions
* commitments
* deadlines
* important changes
* unresolved conflicts

The goal is simple:

> The team should not need to stop working just to keep the rest of the team updated.

Aven runs quietly in the background and only interrupts people when something genuinely needs attention.

---

# 2. Target User

Primary user:

Small, fast-moving teams of roughly 2–15 people.

Examples:

* early-stage startups
* engineering teams
* research groups
* student project teams
* hackathon teams
* small agencies

These teams typically communicate informally and frequently, while important operational context remains scattered across:

* people's heads
* Slack
* meetings
* task managers
* voice conversations
* calendars
* private notes

Aven becomes the shared operational memory between them.

---

# 3. Core Problem

Small teams generate important context continuously:

* “The deployment is blocked.”
* “I finished the migration.”
* “We decided not to ship CSV export.”
* “Rahul will handle the customer issue tomorrow.”
* “The demo moved to Friday.”
* “The customer asked for this feature again.”

Most of this context is never formally recorded.

Traditional tools require people to stop what they are doing, open an app, find the correct project/task/page, and manually update it.

As a result:

* context becomes stale
* commitments disappear
* decisions become ambiguous
* blockers are discovered late
* team members operate with different versions of reality

Aven removes the documentation step.

---

# 4. Core Interaction

A user records a short voice update.

Example:

> “I fixed onboarding. Don't deploy yet though, Ayush still needs to review the migration.”

Aven transcribes the update and eventually produces:

### Progress

* Onboarding fix completed.

### Blockers

* Deployment waiting for migration review.

### Commitments

* Ayush → review migration.

The user does not manually categorize anything.

---

# 5. System Flow

```text
Team Member
    ↓
Voice Capture
    ↓
Hosted API
    ↓
Speech-to-Text
    ↓
Pending Updates
    ↓
Strands Agent
    ↓
Existing Team State + New Updates
    ↓
Reconciliation / Reasoning
    ↓
Updated Team State
    ↓
┌───────────────┬────────────────┬────────────────┐
│ Web Interface │ Google Calendar│ Notifications  │
└───────────────┴────────────────┴────────────────┘
```

---

# 6. Voice Capture

Initial capture flow uses an Apple Shortcut.

The user:

1. activates the Shortcut
2. records a voice message
3. audio is uploaded to the Aven backend
4. audio is transcribed
5. transcript enters the team's update inbox

Audio should not be permanently stored.

The transcript is the durable input.

---

# 7. Agent Processing Model

Aven does not process every sentence independently.

Updates are accumulated and reconciled as batches.

## Active window

When the first new update arrives after an idle period:

1. process the update
2. start a one-hour activity window

During that hour:

* additional updates accumulate
* the existing team state remains available

After approximately one hour:

* Aven processes all new updates
* reconciles them against current state
* generates a new state
* resets the window

If no new updates arrive, nothing runs.

When activity resumes later:

* the new update is processed
* a new activity window begins

This avoids useless periodic agent executions when nothing happened.

---

# 8. Strands Agent Responsibilities

The Strands agent receives:

```text
Existing Team State
+
New Voice Updates
+
Relevant Calendar Context
```

It must determine:

### What happened?

Extract factual updates.

### What changed?

Identify differences from previous state.

### What became obsolete?

Supersede old information when appropriate.

### What was decided?

Record explicit decisions.

### Who committed to what?

Track ownership and intended action.

### What is blocked?

Track blockers and dependencies.

### What matters now?

Identify items requiring human attention.

### Are there contradictions?

Detect conflicting statements or incompatible plans.

---

# 9. State Model

Aven maintains structured team state.

Example:

```json
{
  "progress": [],
  "blockers": [],
  "decisions": [],
  "commitments": [],
  "deadlines": [],
  "signals": [],
  "attention_items": []
}
```

Each entry should contain metadata such as:

```json
{
  "id": "...",
  "text": "...",
  "owner": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "sourceUpdateIds": [],
  "status": "active"
}
```

Historical information should not simply disappear.

Superseded entries should be marked accordingly.

---

# 10. Web Interface

The web application is the main shared surface.

## Primary dashboard

```text
AVEN

Needs Attention
─────────────────────────────────────
⚠ Deployment blocked
  Migration still requires review.

⚠ Conflicting release plan
  Two updates disagree about CSV export.


Current State
─────────────────────────────────────

Progress
✓ Onboarding fixed
→ Stripe integration underway

Blockers
• Stripe webhook behavior
• Migration review

Decisions
• CSV export removed from current release

Commitments
• Ayush → review migration
• Harshit → investigate AWS issue

Upcoming
• Investor demo — Friday, 2 PM


Recent Updates
─────────────────────────────────────
14:42 Harshit
"We're dropping CSV from this release..."

14:31 Ayush
"I've finished the migration..."
```

The interface should answer:

> “What is actually happening right now?”

within a few seconds.

---

# 11. Attention Engine

Most updates should produce no notification.

Aven should notify users only when intervention is useful.

Examples:

### Blocker

> Deployment remains blocked by migration review.

### Conflict

> Harshit said CSV export was removed from the release. Rahul later said he is shipping it tomorrow.

### Deadline risk

> The investor demo is in three hours and onboarding remains blocked.

### Unowned work

> A production issue was reported, but nobody has taken ownership.

### Decision required

> Two implementation paths are currently being discussed. No decision has been recorded.

This is a critical part of the product.

Aven is not another source of notification spam.

---

# 12. Notifications

V1 uses Web Push through the Aven PWA.

Users can add Aven to their phone's Home Screen and enable notifications.

Notifications originate from the attention engine.

Normal state updates remain silent.

---

# 13. Google Calendar Integration

Aven supports Google Calendar through OAuth.

Calendar provides external temporal context.

Aven can:

* read upcoming events
* understand deadlines in relation to meetings
* create calendar events from explicit commitments
* update events when plans change

Example:

> “Let's talk to Vivek tomorrow at four.”

Aven may create:

```text
Vivek discussion
Tomorrow
4:00 PM
```

Calendar actions should only occur when confidence is sufficiently high.

Ambiguous statements should remain in team state rather than creating potentially incorrect events.

---

# 14. Existing Voice Inbox Infrastructure

Aven is built on an existing personal voice ingestion system.

Reusable infrastructure includes:

* Apple Shortcut voice capture
* hosted Next.js API
* Groq Whisper transcription
* durable Postgres transcript inbox
* offline-tolerant delivery architecture

Aven adds the new product layer:

* multi-user/team identity
* Strands agent
* persistent shared state
* reasoning and reconciliation
* batching
* attention detection
* web dashboard
* calendar integration
* Web Push
* team-oriented UX

---

# 15. Backend

Initial backend:

* Next.js
* Vercel
* Postgres
* Groq Whisper
* Strands Agents SDK

Logical services:

```text
/api/capture
/api/updates
/api/state
/api/agent/run
/api/calendar/*
/api/push/*
```

Background agent execution can initially be triggered using scheduled or backend jobs rather than requiring a permanently running server.

---

# 16. Identity

V1 should support:

```text
User
↓
Team
↓
Voice Updates
↓
Shared Team State
```

Every update must contain:

* team ID
* user ID
* timestamp
* transcript

This lets Aven understand statements such as:

> “I'll handle it.”

because the speaker identity is known.

---

# 17. Data Objects

Core entities:

### User

```text
id
name
email
```

### Team

```text
id
name
created_at
```

### Membership

```text
user_id
team_id
role
```

### VoiceUpdate

```text
id
user_id
team_id
text
created_at
processed_at
```

### TeamState

```text
team_id
version
state_json
created_at
```

### AttentionItem

```text
id
team_id
type
message
severity
status
created_at
```

### PushSubscription

```text
user_id
subscription_data
```

### CalendarConnection

```text
user_id
provider
credentials
```

---

# 18. Agent Output Contract

The agent should return structured output rather than arbitrary prose.

Example:

```json
{
  "stateChanges": [],
  "newState": {},
  "attentionItems": [],
  "calendarActions": []
}
```

This makes the surrounding application deterministic.

The agent reasons.

The application executes.

---

# 19. Safety Model

Aven should distinguish between:

### Low-risk automatic actions

* updating internal state
* categorizing an update
* superseding stale information
* creating an attention item

### External actions

* creating calendar events
* sending notifications
* future integrations

External actions require higher confidence.

Potentially destructive actions should not exist in V1.

---

# 20. Demo Scenario

Four-person startup team.

During the demo, different team members record voice updates:

### Update 1

> “I finished the onboarding fix.”

### Update 2

> “Don't deploy yet. The database migration still needs Ayush's review.”

### Update 3

> “We're dropping CSV export from this release.”

### Update 4

> “Actually I'm still working on CSV export and should have it ready tomorrow.”

Aven updates the dashboard:

```text
Progress
✓ Onboarding completed

Blockers
• Deployment waiting for migration review

Decisions
• CSV export removed from release

Attention
⚠ Conflicting CSV export updates detected
```

Then:

> “Investor demo is tomorrow at 2 PM.”

Calendar context makes the unresolved deployment blocker more urgent.

Aven sends:

> Deployment remains blocked by migration review. Investor demo is tomorrow at 2 PM.

This demonstrates:

* voice input
* multi-user understanding
* persistent memory
* state reconciliation
* contradiction detection
* calendar context
* selective notification
* autonomous background operation

---

# 21. Product Principle

Aven should not attempt to replace Slack, Linear, Notion, Calendar, or humans.

Its purpose is to maintain the layer that falls between all of them:

> **What does the team currently believe is happening?**

That is Aven.
