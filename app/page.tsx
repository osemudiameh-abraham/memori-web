"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { VoiceWave } from "@/components/VoiceWave";
import { useDeepgramSTT } from "@/lib/voice/useDeepgramSTT";

// ─── Icons ────────────────────────────────────────────────────────────────────

const StarLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <path d="M50 5C50 5 54 35 70 50C54 65 50 95 50 95C50 95 46 65 30 50C46 35 50 5 50 5Z" fill="#1558D6"/>
    <path d="M5 50C5 50 35 46 50 30C65 46 95 50 95 50C95 50 65 54 50 70C35 54 5 50 5 50Z" fill="#4285F4"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StopSquare = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="white"/>
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

interface GmailDraft {
  to: string;
  subject: string;
  body: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseGmailDraft(text: string): { draft: GmailDraft; preamble: string } | null {
  if (!text.startsWith("__GMAIL_DRAFT__")) return null;
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const draft = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as GmailDraft;
    const preamble = text.slice(jsonEnd + 1).trim();
    return { draft, preamble };
  } catch {
    return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState("there");
  const [reviewBadge, setReviewBadge] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceLog, setVoiceLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingIdRef = useRef<string>("");

  // Voice hook
  const handleVoiceTranscript = useCallback(
    async (text: string) => {
      setVoiceLog(prev => [...prev, { role: "user", text }]);
      try {
        const res = await fetch("/api/chat", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json() as { reply?: string; error?: string };
        const reply = data.reply ?? "I couldn't respond right now.";
        setVoiceLog(prev => [...prev, { role: "assistant", text: reply }]);
        await speakText(reply.slice(0, 500));
      } catch {
        setVoiceError("Connection failed.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const {
    voiceState, start: startVoice, stop: stopVoice,
    isActive: voiceIsActive, analyserNode, speakText,
  } = useDeepgramSTT({ onTranscript: handleVoiceTranscript, onError: msg => setVoiceError(msg) });

  // Load initial data
  useEffect(() => {
    (async () => {
      // First name
      try {
        const r = await fetch("/api/identity-summary", { credentials: "include" });
        if (r.ok) {
          const d = await r.json() as Record<string, unknown>;
          const name = (d.firstName ?? d.name ?? "") as string;
          if (name) setFirstName(name.split(" ")[0]);
        }
      } catch {}

      // Reviews badge
      try {
        const [dueR, todayR] = await Promise.all([
          fetch("/api/reviews/due-count", { credentials: "include" }),
          fetch("/api/reviews/completed-today", { credentials: "include" }),
        ]);
        if (dueR.ok && todayR.ok) {
          const due = await dueR.json() as { count?: number; due_count?: number };
          const today = await todayR.json() as { completed?: boolean; completed_today?: boolean };
          const done = today.completed ?? today.completed_today ?? false;
          if (!done) setReviewBadge(due.count ?? due.due_count ?? 0);
        }
      } catch {}

      // Proactive message
      try {
        const r = await fetch("/api/reminders/proactive", { credentials: "include" });
        if (r.ok) {
          const d = await r.json() as { reminder?: string; message?: string };
          const msg = d.reminder ?? d.message ?? "";
          if (msg) setMessages([{ id: "proactive", role: "assistant", content: msg }]);
        }
      } catch {}
    })();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    setInput("");

    const uid = crypto.randomUUID();
    const aid = crypto.randomUUID();
    pendingIdRef.current = aid;
    setMessages(prev => [
      ...prev,
      { id: uid, role: "user", content: text },
      { id: aid, role: "assistant", content: "", pending: true },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      const reply = data.reply ?? data.error ?? "Something went wrong.";
      setMessages(prev => prev.map(m =>
        m.id === aid ? { ...m, content: reply, pending: false } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === aid ? { ...m, content: "Couldn't reach Seven.", pending: false } : m
      ));
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const chips = [
    { emoji: "🧠", text: "What do you know about me?" },
    { emoji: "📋", text: "Log a decision" },
    { emoji: "🔁", text: "Review my week" },
    { emoji: "⚡", text: "What patterns do you see?" },
    { emoji: "📧", text: "Draft an email" },
  ];

  const hasMessages = messages.length > 0;

  const statusInfo = () => {
    if (voiceState === "listening") return { text: "Listening…", color: "var(--blue)" };
    if (voiceState === "processing") return { text: "Thinking…", color: "var(--yellow)" };
    if (voiceState === "speaking") return { text: "Speaking…", color: "var(--green)" };
    if (voiceState === "connecting" || voiceState === "requesting") return { text: "Connecting…", color: "var(--text-muted)" };
    return { text: "Tap mic to speak", color: "var(--text-muted)" };
  };

  return (
    <AppShell reviewBadge={reviewBadge}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* Scrollable messages / empty state */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {!hasMessages ? (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "0 24px 48px", minHeight: 400,
            }}>
              <StarLogo size={44} />
              <div style={{ height: 20 }} />
              <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 6 }}>
                Hi {firstName}
              </p>
              <h1 style={{
                fontSize: "clamp(28px, 5vw, 44px)",
                fontWeight: 400,
                color: "var(--text-primary)",
                textAlign: "center",
                lineHeight: 1.15,
              }}>
                Where should we start?
              </h1>
            </div>
          ) : (
            <div style={{ flex: 1, paddingBottom: 16 }}>
              {messages.map(msg => {
                const gmailParsed = msg.role === "assistant" ? parseGmailDraft(msg.content) : null;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: msg.role === "user" ? "row-reverse" : "row",
                      alignItems: "flex-start",
                      padding: "10px 24px",
                      gap: 10,
                    }}
                  >
                    {msg.role === "assistant" && (
                      <div style={{ flexShrink: 0, marginTop: 4 }}><StarLogo size={28} /></div>
                    )}
                    <div style={{ maxWidth: "70%", minWidth: 40 }}>
                      {msg.pending ? (
                        <div style={{ display: "flex", gap: 5, padding: "14px 4px", alignItems: "center" }}>
                          {[0, 1, 2].map(i => (
                            <span key={i} style={{
                              width: 7, height: 7, borderRadius: "50%",
                              background: "var(--text-muted)", display: "block",
                              animation: `dotpulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                            }} />
                          ))}
                        </div>
                      ) : gmailParsed ? (
                        <GmailDraftCard draft={gmailParsed.draft} preamble={gmailParsed.preamble} />
                      ) : (
                        <div style={{
                          background: msg.role === "user" ? "var(--blue-light)" : "transparent",
                          borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : 4,
                          padding: msg.role === "user" ? "12px 18px" : "4px 0",
                          color: "var(--text-primary)",
                          fontSize: 15,
                          lineHeight: 1.65,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{
          padding: "0 24px 20px",
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          {/* Chips */}
          {!hasMessages && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {chips.map(chip => (
                <button
                  key={chip.text}
                  onClick={() => sendMessage(chip.text)}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: "var(--radius-chip)",
                    padding: "10px 18px",
                    fontSize: 13, fontWeight: 500,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-card)",
                    transition: "background var(--transition)",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f1f3f4")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
                >
                  <span>{chip.emoji}</span>
                  <span>{chip.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input card */}
          <div style={{
            width: "100%", maxWidth: 760,
            background: "var(--surface)",
            borderRadius: "var(--radius-pill)",
            boxShadow: "var(--shadow-card)",
            display: "flex", alignItems: "flex-end",
            padding: "10px 12px 10px 16px", gap: 8,
          }}>
            <button
              title="Attach"
              style={{
                flexShrink: 0, marginBottom: 2, padding: 6,
                borderRadius: "50%", color: "var(--text-muted)",
              }}
            >
              <PlusIcon />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Seven anything…"
              rows={1}
              style={{
                flex: 1, border: "none", outline: "none",
                resize: "none", fontSize: 15,
                color: "var(--text-primary)", background: "transparent",
                lineHeight: 1.55, minHeight: 24, maxHeight: 160,
                overflow: "auto", padding: 0,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginBottom: 2 }}>
              <button
                onClick={() => { setVoiceOpen(true); setVoiceLog([]); setVoiceError(null); startVoice(); }}
                title="Voice"
                style={{
                  padding: 6, borderRadius: "50%",
                  color: voiceIsActive ? "var(--blue)" : "var(--text-muted)",
                  transition: "color var(--transition)",
                }}
              >
                <MicIcon />
              </button>
              {input.trim() && (
                <button
                  onClick={() => sendMessage()}
                  title="Send"
                  style={{
                    background: "var(--blue)", color: "#fff",
                    borderRadius: "50%", width: 34, height: 34,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <SendIcon />
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Seven may make mistakes. Review important decisions yourself.
          </p>
        </div>
      </div>

      {/* Voice overlay */}
      {voiceOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "var(--surface)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "space-between",
          padding: "80px 24px 60px",
        }}>
          {/* Status */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: statusInfo().color, transition: "color var(--transition)" }}>
              {statusInfo().text}
            </p>
            {voiceError && <p style={{ fontSize: 13, color: "var(--red)" }}>{voiceError}</p>}
          </div>

          {/* Waveform + transcript */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, width: "100%", maxWidth: 400 }}>
            <VoiceWave
              isActive={voiceState === "listening" || voiceState === "speaking"}
              analyserNode={analyserNode}
              color="#1558D6"
              width={320}
              height={80}
            />
            {voiceLog.length > 0 && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                {voiceLog.slice(-3).map((t, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: t.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "80%",
                      background: t.role === "user" ? "var(--blue-light)" : "transparent",
                      color: t.role === "user" ? "var(--text-primary)" : "var(--blue)",
                      borderRadius: 14, padding: "8px 14px",
                      fontSize: 14, lineHeight: 1.5,
                    }}>
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stop button */}
          <button
            onClick={() => { stopVoice(); setVoiceOpen(false); }}
            style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "var(--red)", display: "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(234,67,53,0.4)",
              transition: "transform var(--transition)",
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.06)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            title="Stop"
          >
            <StopSquare />
          </button>
        </div>
      )}

      <style>{`
        @keyframes dotpulse {
          0%, 100% { opacity: 0.3; transform: scale(0.75); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </AppShell>
  );
}

// ─── Gmail draft card ─────────────────────────────────────────────────────────

function GmailDraftCard({ draft, preamble }: { draft: GmailDraft; preamble: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "cancelled">("idle");

  const execute = async (approved: boolean) => {
    setStatus("sending");
    try {
      await fetch("/api/actions/execute", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "gmail_draft", params: draft, approved }),
      });
    } catch {}
    setStatus(approved ? "done" : "cancelled");
  };

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16,
      boxShadow: "var(--shadow-card)", padding: 20, maxWidth: 400,
    }}>
      {preamble && <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>{preamble}</p>}
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Draft email</p>
      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>To: {draft.to}</p>
      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 12 }}>Subject: {draft.subject}</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6, marginBottom: 16 }}>{draft.body}</p>
      {status === "idle" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => execute(true)} style={{ background: "var(--blue)", color: "#fff", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500 }}>Send</button>
          <button onClick={() => execute(false)} style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-secondary)", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500 }}>Cancel</button>
        </div>
      )}
      {status === "sending" && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Processing…</p>}
      {status === "done" && <p style={{ fontSize: 13, color: "var(--green)" }}>✓ Draft saved to Gmail</p>}
      {status === "cancelled" && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Cancelled</p>}
    </div>
  );
}
