"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const TOKEN_KEY = "aven_capture_token";

export default function CaptureApp() {
  const [token, setToken] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY) ?? "");
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    return () => { if (timer.current) window.clearInterval(timer.current); recorder.current?.stream.getTracks().forEach((track) => track.stop()); };
  }, []);

  function saveToken(value: string) { setToken(value); localStorage.setItem(TOKEN_KEY, value.trim()); setMessage("Credential saved on this device."); }
  function stopTimer() { if (timer.current) window.clearInterval(timer.current); timer.current = null; }
  function stopRecording() { recorder.current?.stop(); stopTimer(); setRecording(false); }
  async function startRecording() {
    setError(null); setMessage(null);
    if (!token.trim()) { setError("Add your capture credential first."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError("This browser does not support audio recording."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = () => { stream.getTracks().forEach((track) => track.stop()); void upload(new Blob(chunks.current, { type: next.mimeType || "audio/webm" })); };
      recorder.current = next; next.start(); setSeconds(0); setRecording(true);
      timer.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch { setError("Microphone access was denied or unavailable."); }
  }
  async function upload(blob: Blob) {
    setSending(true); setError(null); setMessage(null);
    try {
      const form = new FormData(); form.append("audio", blob, "aven-recording.webm");
      const response = await fetch("/api/capture", { method: "POST", headers: { Authorization: `Bearer ${token.trim()}` }, body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Upload failed");
      setMessage("Update captured. Aven is reconciling it with team memory.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed. Try again."); }
    finally { setSending(false); }
  }
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <main className="capture-shell"><div className="capture-card"><div className="capture-brand"><span className="brand-mark"><i /><i /><i /></span><span>aven</span><span className="capture-label">VOICE CAPTURE</span></div><div className="capture-heading"><p className="eyebrow">PRIVATE TEAM INPUT</p><h1>Say what changed.</h1><p>Record a quick update. Aven turns it into shared team memory.</p></div><button className={`record-button ${recording ? "is-recording" : ""}`} onClick={recording ? stopRecording : () => void startRecording()} disabled={sending} aria-label={recording ? "Stop recording" : "Start recording"}><span className="record-orb">{recording ? <i /> : <span>●</span>}</span><strong>{recording ? "Stop recording" : "Record update"}</strong><small>{recording ? time : "Tap to begin"}</small></button>{sending && <p className="capture-status">Transcribing your update...</p>}{message && <p className="capture-status success">{message}</p>}{error && <p className="capture-status failure">{error}</p>}<details className="credential-panel"><summary>Capture credential</summary><p>Stored only in this browser&apos;s local storage.</p><div className="token-row"><input value={token} onChange={(event) => setToken(event.target.value)} onBlur={() => saveToken(token)} placeholder="aven_capture_v1..." type="password" autoComplete="off" /><button onClick={() => saveToken(token)}>Save</button></div><button className="clear-token" onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(""); setMessage("Credential removed."); }}>Clear credential</button></details><Link className="dashboard-link" href="/">Open team dashboard <span>↗</span></Link></div></main>;
}
