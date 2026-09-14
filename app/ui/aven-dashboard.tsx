"use client";

import { useCallback, useEffect, useState } from "react";

type ItemKind = "attention" | "progress" | "blocker" | "decision" | "commitment" | "deadline";

export type TeamItem = { id: string; kind: ItemKind; text: string; owner?: string; detail?: string; dueAt?: string; severity?: "urgent" | "watch" | "normal" };
export type VoiceUpdate = { id: string; speaker: string; initials: string; text: string; createdAt: string; extractedCount: number };
export type DashboardData = { team: { id?: string; name: string; activeWindowEndsAt?: string }; generatedAt: string; state: Record<ItemKind, TeamItem[]>; recentUpdates: VoiceUpdate[] };
type View = "overview" | "calendar" | "setup";
type Calendar = { id: string; summary: string; primary: boolean; accessRole: string };
type CalendarEvent = { id: string; summary: string; start: string; end: string; htmlLink?: string };
type ShortcutMember = { id: string; name: string; email: string; shortcut: { name: string; url: string; method: "POST"; headers: { Authorization: string }; body: { type: "multipart"; field: "audio" }; successMessage: string } };

type ApiEntry = { id: string; text: string; owner: string | null; createdAt: string; updatedAt: string; sourceUpdateIds: string[]; status: string };
type ApiAttention = { id: string; type: string; message: string; severity: string; status: string; sourceUpdateIds: string[]; createdAt: string };
type ApiDashboard = {
  generatedAt: string;
  team: { id: string; name: string; activeWindowEndsAt: string | null };
  state: { version: number; updatedAt: string | null; attention: ApiAttention[]; progress: ApiEntry[]; blocker: ApiEntry[]; decision: ApiEntry[]; commitment: ApiEntry[]; deadline: ApiEntry[]; signal: ApiEntry[] };
  recentUpdates: Array<{ id: string; speaker: string; userId: string; text: string; createdAt: string }>;
};

async function getDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const response = await fetch("/api/dashboard", { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Dashboard request failed with ${response.status}`);
  const payload = await response.json() as ApiDashboard;
  const mapEntries = (kind: ItemKind, entries: ApiEntry[]): TeamItem[] => entries.map((entry) => ({ id: entry.id, kind, text: entry.text, owner: entry.owner || undefined, detail: entry.status === "active" ? undefined : entry.status }));
  return {
    generatedAt: payload.generatedAt,
    team: { id: payload.team.id, name: payload.team.name, activeWindowEndsAt: payload.team.activeWindowEndsAt || undefined },
    state: {
      attention: payload.state.attention.map((entry) => ({ id: entry.id, kind: "attention", text: entry.message, detail: entry.type.replaceAll("_", " "), severity: entry.severity === "urgent" ? "urgent" : "watch" })),
      progress: mapEntries("progress", payload.state.progress), blocker: mapEntries("blocker", payload.state.blocker),
      decision: mapEntries("decision", payload.state.decision), commitment: mapEntries("commitment", payload.state.commitment), deadline: mapEntries("deadline", payload.state.deadline),
    },
    recentUpdates: payload.recentUpdates.map((update) => ({ ...update, initials: update.speaker.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), extractedCount: 0 })),
  };
}

const now = Date.now();
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const minutesAhead = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

const demoData: DashboardData = {
  team: { name: "Launch team", activeWindowEndsAt: minutesAhead(47) }, generatedAt: minutesAgo(3),
  state: {
    attention: [
      { id: "a1", kind: "attention", text: "Deployment is waiting on the migration review", owner: "Ayush", detail: "Harshit marked onboarding complete, but asked the team to hold the deploy.", severity: "urgent" },
      { id: "a2", kind: "attention", text: "Two different demo dates were mentioned", detail: "Riya said Friday. The shared calendar still shows Thursday.", severity: "watch" },
    ],
    progress: [
      { id: "p1", kind: "progress", text: "Onboarding fix completed", owner: "Harshit", detail: "Ready after migration review" },
      { id: "p2", kind: "progress", text: "Customer import tested with production data", owner: "Maya", detail: "1,240 records imported" },
      { id: "p3", kind: "progress", text: "Demo narrative drafted", owner: "Riya", detail: "First pass shared" },
    ],
    blocker: [
      { id: "b1", kind: "blocker", text: "Migration needs a second review", owner: "Ayush", detail: "Blocks production deployment" },
      { id: "b2", kind: "blocker", text: "Calendar scope awaiting approval", owner: "Harshit", detail: "Demo can proceed with read only access" },
    ],
    decision: [
      { id: "d1", kind: "decision", text: "CSV export will not ship in this release", detail: "Team is prioritizing the live reconciliation demo" },
      { id: "d2", kind: "decision", text: "Use read only calendar access for the demo", detail: "Decided today" },
    ],
    commitment: [
      { id: "c1", kind: "commitment", text: "Review the migration", owner: "Ayush", dueAt: minutesAhead(180) },
      { id: "c2", kind: "commitment", text: "Record the final product walkthrough", owner: "Riya", dueAt: minutesAhead(1440) },
      { id: "c3", kind: "commitment", text: "Confirm calendar permissions", owner: "Harshit", dueAt: minutesAhead(300) },
    ],
    deadline: [
      { id: "dl1", kind: "deadline", text: "Production deployment", dueAt: minutesAhead(420), detail: "Today" },
      { id: "dl2", kind: "deadline", text: "Demo recording", dueAt: minutesAhead(1620), detail: "Tomorrow" },
    ],
  },
  recentUpdates: [
    { id: "u1", speaker: "Harshit", initials: "HB", text: "I fixed onboarding. Do not deploy yet though, Ayush still needs to review the migration.", createdAt: minutesAgo(8), extractedCount: 3 },
    { id: "u2", speaker: "Maya", initials: "MK", text: "The customer import passed on the full production sample. All 1,240 records look good.", createdAt: minutesAgo(24), extractedCount: 2 },
    { id: "u3", speaker: "Riya", initials: "RS", text: "I have the first demo narrative ready. I will record the final walkthrough tomorrow.", createdAt: minutesAgo(51), extractedCount: 2 },
  ],
};

const icons: Record<string, React.ReactNode> = {
  attention: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Zm0 5.5v5M12 17h.01" /></svg>,
  progress: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>,
  blocker: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="m7 17 10-10" /></svg>,
  decision: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-3.7 10.7c.9.7 1.2 1.4 1.2 2.3h5c0-.9.3-1.6 1.2-2.3A6 6 0 0 0 12 3ZM9.5 20h5" /></svg>,
  commitment: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14v15H5z" /></svg>,
  deadline: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  voice: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
};

function relativeTime(value: string) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  return formatter.format(Math.round(minutes / 60), "hour");
}

function Avatar({ name }: { name: string }) { return <span className="avatar" title={name}>{name.slice(0, 1)}</span> }
function EmptyCard({ label }: { label: string }) { return <div className="empty-card"><span>{icons.progress}</span><p>No active {label}</p></div> }

function CalendarSettings({ onBack }: { onBack: () => void }) {
  const [connected, setConnected] = useState(false); const [calendars, setCalendars] = useState<Calendar[]>([]); const [selected, setSelected] = useState(""); const [events, setEvents] = useState<CalendarEvent[]>([]); const [loading, setLoading] = useState(true); const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setMessage(null); try { const status = await fetch("/api/integrations/google/status").then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<{ connected: boolean; selectedCalendarId: string | null }> }); setConnected(status.connected); if (status.connected) { const [calendarData, eventData] = await Promise.all([fetch("/api/integrations/google/calendars").then((r) => r.json() as Promise<{ calendars: Calendar[]; selectedCalendarId: string | null }>), fetch("/api/integrations/google/calendar").then((r) => r.json() as Promise<{ events: CalendarEvent[] }>) ]); setCalendars(calendarData.calendars); setSelected(calendarData.selectedCalendarId || ""); setEvents(eventData.events || []) } } catch { setMessage("Calendar status could not be loaded. Try again when the integration service is ready.") } finally { setLoading(false) } }, []);
  useEffect(() => { void load() }, [load]);
  async function switchCalendar(calendarId: string) { setSelected(calendarId); setMessage(null); try { const response = await fetch("/api/integrations/google/calendars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendarId }) }); if (!response.ok) throw new Error(); setMessage("Calendar switched successfully."); await load() } catch { setMessage("Aven could not switch calendars.") } }
  async function createEvent() { setMessage(null); const start = new Date(Date.now() + 86_400_000); start.setHours(10, 0, 0, 0); const end = new Date(start.getTime() + 30 * 60_000); try { const response = await fetch("/api/integrations/google/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: "Aven team pulse", description: "Created from Aven", start: start.toISOString(), end: end.toISOString() }) }); if (!response.ok) throw new Error(); setMessage("Demo event created for tomorrow at 10:00 AM."); await load() } catch { setMessage("The demo event could not be created.") } }
  async function disconnect() { setMessage(null); try { const response = await fetch("/api/integrations/google/disconnect", { method: "POST" }); if (!response.ok) throw new Error(); setConnected(false); setCalendars([]); setEvents([]); setMessage("Google Calendar disconnected.") } catch { setMessage("Google Calendar could not be disconnected.") } }
  return <Surface title="Calendar" eyebrow="INTEGRATIONS" description="Give Aven calendar context and turn commitments into real events." onBack={onBack}>{loading ? <PanelLoading label="Checking Google Calendar" /> : !connected ? <section className="connect-card"><span className="google-mark">G</span><h2>Connect Google Calendar</h2><p>Aven reads the calendar you choose and creates events only when you ask.</p><a className="primary-action" href="/api/integrations/google/connect">Connect Google</a>{message && <p className="surface-message error-message">{message}</p>}</section> : <><div className="connection-card"><div><span className="google-mark small">G</span><div><span className="success-label"><i />CONNECTED</span><h2>Google Calendar</h2><p>Calendar access is active through your Google account.</p></div></div><button className="danger-link" onClick={disconnect}>Disconnect</button></div>{message && <p className="surface-message">{message}</p>}<div className="settings-grid"><section className="settings-panel"><p className="eyebrow">CALENDAR TO USE</p><h2>Choose where Aven works</h2><select value={selected} onChange={(event) => void switchCalendar(event.target.value)} aria-label="Selected calendar">{calendars.map((calendar) => <option value={calendar.id} key={calendar.id}>{calendar.summary}{calendar.primary ? " (Primary)" : ""}</option>)}</select><button className="primary-action button-action" onClick={createEvent}>Create demo event</button><p className="privacy-note">Aven uses the selected calendar for team deadlines and commitments.</p></section><section className="settings-panel events"><p className="eyebrow">UP NEXT</p><h2>Upcoming events</h2>{events.length ? events.slice(0, 5).map((event) => <article key={event.id}><span className="event-dot" /><div><h3>{event.summary}</h3><p>{new Date(event.start).toLocaleString("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p></div></article>) : <div className="compact-empty">No upcoming events</div>}</section></div></>}</Surface>
}

function ShortcutSetup({ teamId, onBack }: { teamId?: string; onBack: () => void }) {
  const [members, setMembers] = useState<ShortcutMember[]>([]); const [selectedId, setSelectedId] = useState(""); const [teamName, setTeamName] = useState("your team"); const [loading, setLoading] = useState(true); const [message, setMessage] = useState<string | null>(null); const [copied, setCopied] = useState<string | null>(null); const [accessCode, setAccessCode] = useState(""); const [needsUnlock, setNeedsUnlock] = useState(false);
  const loadSetup = useCallback(async (code?: string) => { setLoading(true); setMessage(null); const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""; try { const response = await fetch(`/api/members/setup${query}`, { headers: code ? { Authorization: `Bearer ${code}` } : undefined }); if (response.status === 401) { setNeedsUnlock(true); setMembers([]); setMessage(code ? "That access code was not accepted. Check it and try again." : null); return } if (!response.ok) throw new Error(); const payload = await response.json() as { team: { id: string; name: string }; members: ShortcutMember[] }; setMembers(payload.members); setTeamName(payload.team.name); setSelectedId(payload.members[0]?.id || ""); setNeedsUnlock(false); if (code) sessionStorage.setItem("avenShortcutSetupCode", code); setAccessCode("") } catch { setNeedsUnlock(true); setMembers([]); setMessage("Aven could not unlock setup. Check the connection and try again.") } finally { setLoading(false) } }, [teamId]);
  useEffect(() => { const storedCode = sessionStorage.getItem("avenShortcutSetupCode") || undefined; void loadSetup(storedCode) }, [loadSetup]);
  const member = members.find((item) => item.id === selectedId);
  function clearAccess() { sessionStorage.removeItem("avenShortcutSetupCode"); setAccessCode(""); setMembers([]); setSelectedId(""); setNeedsUnlock(true); setMessage("Access cleared from this browser session.") }
  async function copy(label: string, value: string) { try { await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(null), 1800) } catch { setMessage("Copy failed. Select the value manually.") } }
  function download() { if (!member) return; const config = JSON.stringify({ team: teamName, member: member.name, ...member.shortcut }, null, 2); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([config], { type: "application/json" })); link.download = `aven-${member.name.toLowerCase().replaceAll(" ", "-")}-shortcut.json`; link.click(); URL.revokeObjectURL(link.href); setMessage("Shortcut configuration downloaded.") }
  return <Surface title="iPhone Shortcut" eyebrow="VOICE CAPTURE" description="Set up personal, one tap voice capture for every teammate." onBack={onBack}>{loading ? <PanelLoading label="Preparing member setup" /> : needsUnlock ? <section className="unlock-card"><span className="lock-mark">⌁</span><p className="eyebrow">ADMIN ACCESS</p><h2>Unlock Shortcut setup</h2><p>Enter the private setup code to reveal personal capture configurations. The code stays in this browser session.</p><form onSubmit={(event) => { event.preventDefault(); if (accessCode.trim()) void loadSetup(accessCode.trim()) }}><label htmlFor="setup-code">Access code</label><div><input id="setup-code" type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="off" autoFocus placeholder="Enter access code" /><button type="submit" disabled={!accessCode.trim()}>Unlock setup</button></div></form>{message && <p className="unlock-error" role="alert">{message}</p>}<button className="clear-access" onClick={clearAccess}>Clear saved access</button></section> : member ? <><div className="setup-header"><div><span className="step-badge">1</span><div><p className="eyebrow">CHOOSE A TEAMMATE</p><h2>Whose phone is this?</h2></div></div><div className="setup-select"><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{members.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.email}</option>)}</select><button onClick={clearAccess}>Lock</button></div></div><div className="shortcut-grid"><section className="phone-preview"><div className="phone"><div className="dynamic-island" /><div className="shortcut-app"><span className="shortcut-glyph">⌁</span><p>SHORTCUT</p><h3>{member.shortcut.name}</h3><button><span>{icons.voice}</span>Record update</button><small>{member.name} · {teamName}</small></div></div></section><section className="instructions"><p className="eyebrow">EXACT SHORTCUT ACTIONS</p><h2>Build it in three actions</h2><ol><li><span>1</span><div><h3>Record Audio</h3><p>Quality: Normal. Start recording immediately.</p></div></li><li><span>2</span><div><h3>Get Contents of URL</h3><p>Method POST. Request body Form. Add file field named audio using Recorded Audio.</p></div></li><li><span>3</span><div><h3>Show Notification</h3><p>{member.shortcut.successMessage}</p></div></li></ol><div className="credential"><label>CAPTURE URL</label><div><code>{member.shortcut.url}</code><button onClick={() => void copy("url", member.shortcut.url)}>{copied === "url" ? "Copied" : "Copy"}</button></div></div><div className="credential"><label>AUTHORIZATION HEADER</label><div><code>{member.shortcut.headers.Authorization}</code><button onClick={() => void copy("token", member.shortcut.headers.Authorization)}>{copied === "token" ? "Copied" : "Copy"}</button></div></div><button className="primary-action button-action full" onClick={download}>Download configuration</button>{message && <p className="surface-message">{message}</p>}</section></div><div className="privacy-strip"><span>◉</span><div><strong>Voice stays ephemeral</strong><p>Audio uploads directly to Aven, is transcribed in memory, then discarded. Only the transcript becomes part of team memory.</p></div></div></> : <section className="connect-card"><h2>No team members yet</h2><p>Add a member before creating a personal Shortcut.</p><button className="clear-access" onClick={clearAccess}>Clear access</button></section>}</Surface>
}

function Surface({ title, eyebrow, description, onBack, children }: { title: string; eyebrow: string; description: string; onBack: () => void; children: React.ReactNode }) { return <div className="content surface"><button className="back-link" onClick={onBack}>← Overview</button><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></div>{children}</div> }
function PanelLoading({ label }: { label: string }) { return <section className="panel-loading"><span className="spin">↻</span><p>{label}</p></section> }

function MetricCard({ kind, label, items }: { kind: ItemKind; label: string; items: TeamItem[] }) {
  return <section className={`metric-card ${kind}`}><header><span className="icon">{icons[kind]}</span><h2>{label}</h2><span className="count">{items.length}</span></header>
    {items.length ? <div className="metric-list">{items.map((item) => <article className="metric-row" key={item.id}><span className="row-mark" /><div><h3>{item.text}</h3><p>{item.detail || (item.dueAt ? relativeTime(item.dueAt) : item.owner ? `${item.owner} owns this` : "Active")}</p></div>{item.owner && <Avatar name={item.owner} />}</article>)}</div> : <EmptyCard label={label.toLowerCase()} />}
  </section>;
}

export function AvenDashboard() {
  const [view, setView] = useState<View>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [data, setData] = useState<DashboardData>(demoData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { setLoading(true); setError(null); try { setData(await getDashboard()) } catch { setError("Live data is unavailable. Showing the latest saved view.") } finally { setLoading(false) } }, []);
  useEffect(() => { const controller = new AbortController(); getDashboard(controller.signal).then(setData).catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError("Live data is unavailable. Showing the latest saved view.") }).finally(() => setLoading(false)); return () => controller.abort() }, []);
  const state = data.state;
  const empty = Object.values(state).every((items) => items.length === 0) && data.recentUpdates.length === 0;

  return <main className="shell">
    <aside className="sidebar"><button className="brand" onClick={() => setView("overview")} aria-label="Aven home"><span className="brand-mark"><i /><i /><i /></span><span>aven</span></button><nav aria-label="Main navigation"><button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>{icons.progress}<span>Overview</span></button><button onClick={() => { setView("overview"); location.hash = "attention" }}>{icons.attention}<span>Needs attention</span><b>{state.attention.length}</b></button><button onClick={() => { setView("overview"); location.hash = "updates" }}>{icons.voice}<span>Voice updates</span></button><button onClick={() => setView("calendar")}>{icons.deadline}<span>Calendar</span></button><button onClick={() => setView("setup")}>{icons.voice}<span>iPhone setup</span></button></nav><div className="sidebar-foot"><span className="pulse" /><div><strong>Agent listening</strong><small>Window closes {data.team.activeWindowEndsAt ? relativeTime(data.team.activeWindowEndsAt) : "when idle"}</small></div></div></aside>
    <div className="workspace" id="top"><header className="topbar"><button className="menu" aria-label="Open navigation" aria-expanded={mobileNav} onClick={() => setMobileNav((open) => !open)}><span /><span /><span /></button><div className="team-switcher"><span className="team-avatar">LT</span><div><small>Workspace</small><strong>{data.team.name}</strong></div><span className="chevron">⌄</span></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">{icons.attention}<i /></button><Avatar name="Harshit" /></div></header>
      {mobileNav && <nav className="mobile-nav" aria-label="Mobile navigation"><button onClick={() => { setView("overview"); setMobileNav(false) }}>Overview</button><button onClick={() => { setView("calendar"); setMobileNav(false) }}>Calendar</button><button onClick={() => { setView("setup"); setMobileNav(false) }}>iPhone setup</button></nav>}
      {view === "calendar" ? <CalendarSettings onBack={() => setView("overview")} /> : view === "setup" ? <ShortcutSetup teamId={data.team.id} onBack={() => setView("overview")} /> : <div className="content" id="overview"><div className="page-heading"><div><p className="eyebrow">TEAM PULSE</p><h1>Good morning, Harshit.</h1><p>Aven reconciled your team&apos;s latest updates {relativeTime(data.generatedAt)}.</p></div><button className="refresh" onClick={refresh} disabled={loading}><span className={loading ? "spin" : ""}>↻</span>{loading ? "Reconciling" : "Refresh state"}</button></div>
        {error && <div className="notice" role="status"><span>{icons.attention}</span><p>{error}</p><button onClick={refresh}>Try again</button></div>}
        {empty ? <section className="zero-state"><span>{icons.voice}</span><h2>Your team memory is ready</h2><p>Send a voice update and Aven will turn it into shared progress, decisions, and commitments.</p></section> : <>
          <section className="attention-panel" id="attention"><header><div><span className="icon">{icons.attention}</span><div><p>NEEDS ATTENTION</p><h2>{state.attention.length} things need a human call</h2></div></div><span className="freshness"><i />Updated {relativeTime(data.generatedAt)}</span></header><div className="attention-grid">{state.attention.map((item, index) => <article key={item.id} className={item.severity === "urgent" ? "urgent" : "watch"}><span className="attention-number">{String(index + 1).padStart(2, "0")}</span><div><span className="tag">{item.severity === "urgent" ? "BLOCKED" : "CONFLICT"}</span><h3>{item.text}</h3><p>{item.detail}</p>{item.owner && <span className="owner"><Avatar name={item.owner} />{item.owner} owns next step</span>}</div><button aria-label={`Open ${item.text}`}>↗</button></article>)}</div></section>
          <div className="section-heading"><div><p className="eyebrow">CURRENT STATE</p><h2>What the team knows</h2></div><p>{state.progress.length + state.blocker.length + state.decision.length + state.commitment.length} active signals</p></div>
          <div className="metrics-grid"><MetricCard kind="progress" label="Progress" items={state.progress} /><MetricCard kind="blocker" label="Blockers" items={state.blocker} /><MetricCard kind="decision" label="Decisions" items={state.decision} /><div id="commitments"><MetricCard kind="commitment" label="Commitments" items={state.commitment} /></div></div>
          <div className="lower-grid"><section className="updates-panel" id="updates"><header><div><span className="icon">{icons.voice}</span><div><p className="eyebrow">VOICE STREAM</p><h2>Recent updates</h2></div></div><button>View all</button></header><div>{data.recentUpdates.map((update) => <article className="update" key={update.id}><span className="speaker-avatar">{update.initials}</span><div><p><strong>{update.speaker}</strong><time>{relativeTime(update.createdAt)}</time></p><blockquote>“{update.text}”</blockquote>{update.extractedCount > 0 && <span className="extracted">{update.extractedCount} signals extracted</span>}</div></article>)}</div></section>
            <section className="deadline-panel"><header><span className="icon">{icons.deadline}</span><div><p className="eyebrow">ON THE CLOCK</p><h2>Upcoming</h2></div></header><div>{state.deadline.map((item) => <article key={item.id}><div className="date-tile">{item.dueAt ? <><strong>{new Date(item.dueAt).getDate()}</strong><span>{new Date(item.dueAt).toLocaleString("en", { month: "short" }).toUpperCase()}</span></> : <>{icons.deadline}</>}</div><div><h3>{item.text}</h3><p>{item.dueAt ? `${item.detail || "Due"} · ${relativeTime(item.dueAt)}` : item.detail || "Upcoming"}</p></div></article>)}</div><button className="calendar-button">Open calendar <span>↗</span></button></section></div>
        </>}
      </div>}</div>
  </main>;
}
