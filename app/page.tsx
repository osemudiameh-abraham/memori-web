"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDeepgramSTT } from "@/lib/voice/useDeepgramSTT";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};
type ChatResponse = { ok: boolean; text?: string; error?: string };
type IdentitySummaryResponse = { ok: true; summary: string } | { ok: false; error: string };
type DueCountResponse = { ok: true; due_count: number } | { ok: false; error: string };
type CompletedTodayResponse = { ok: true; completed_today: boolean } | { ok: false; error: string };
type FirstDueResponse = { ok: true; decision_id: string | null } | { ok: false; error: string };

const DISMISS_KEY = "memori_reviews_banner_dismissed_day";
const SHOWN_KEY = "memori_reviews_banner_shown_day";
const FIRST_CHAT_CHECK_KEY = "memori_reviews_checked_on_first_chat_day";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function makeRequestId(): string {
  try { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID(); } catch {}
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function isAbortError(e: unknown): boolean {
  return !!(e && typeof e === "object" && (e as { name?: string }).name === "AbortError");
}

/* ── Icons ── */
function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
function IconStop() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
function IconX() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconVault() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7M12 17v-2M9 12H7M17 12h-2"/>
    </svg>
  );
}
function IconFacts() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
function IconTrace() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function IconReviews() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function IconDigest() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}
function IconOnboarding() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function MemoriOrb({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id="morb2" cx="30%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#F5C84A" />
          <stop offset="42%" stopColor="#85D4C8" />
          <stop offset="100%" stopColor="#52B8D8" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#morb2)" />
      <ellipse cx="50" cy="36" rx="17" ry="22" fill="white" opacity="0.92" />
      <path d="M25 74 Q26 58 50 58 Q74 58 75 74" fill="white" opacity="0.92" />
    </svg>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "#a89880", display: "inline-block",
          animation: `mtd 1.4s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}

const SUGGESTIONS = [
  "What do you know about me?",
  "Log a new decision",
  "Review my week",
  "What patterns do you see?",
];

const NAV_ITEMS = [
  { href: "/vault",      label: "Memory Vault",  Icon: IconVault,      desc: "Browse stored facts" },
  { href: "/facts",      label: "Facts audit",   Icon: IconFacts,      desc: "Review & edit facts" },
  { href: "/trace",      label: "Trace audit",   Icon: IconTrace,      desc: "Source traceability" },
  { href: "/reviews",    label: "Reviews",       Icon: IconReviews,    desc: "Decision follow-ups" },
  { href: "/digest",     label: "Digest",        Icon: IconDigest,     desc: "Weekly summary" },
  { href: "/onboarding", label: "Onboarding",    Icon: IconOnboarding, desc: "Setup & preferences" },
];

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [dueCount, setDueCount] = useState(0);
  const [bannerHidden, setBannerHidden] = useState(true);
  const [completedToday, setCompletedToday] = useState(false);
  const [reviewNowBusy, setReviewNowBusy] = useState(false);
  const [reminder, setReminder] = useState<string | null>(null);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const sendingRef = useRef(false);
  const abortChatRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef2 = useRef<HTMLTextAreaElement>(null);

  const dismissedToday = useMemo(() => {
    try { return localStorage.getItem(DISMISS_KEY) === todayLocal(); } catch { return true; }
  }, []);
  const shownToday = useMemo(() => {
    try { return localStorage.getItem(SHOWN_KEY) === todayLocal(); } catch { return true; }
  }, []);
  function markShownToday() { try { localStorage.setItem(SHOWN_KEY, todayLocal()); } catch {} }
  function dismissToday() { setBannerHidden(true); try { localStorage.setItem(DISMISS_KEY, todayLocal()); } catch {} }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  useEffect(() => {
    async function loadUser() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setLoadingUser(false);
    }
    void loadUser();
  }, []);

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/identity-summary");
      const data = (await res.json()) as IdentitySummaryResponse;
      setSummary(!res.ok || !data.ok ? "" : data.summary);
    } catch { setSummary(""); } finally { setSummaryLoading(false); }
  }

  async function loadReminder() {
    try {
      const res = await fetch("/api/reminders/proactive");
      const data = await res.json() as { ok: boolean; reminder?: { text: string } };
      setReminder(res.ok && data.ok && data.reminder ? data.reminder.text : null);
    } catch { setReminder(null); }
  }

  async function loadCompletedToday(): Promise<boolean> {
    try {
      const res = await fetch("/api/reviews/completed-today");
      const data = (await res.json()) as CompletedTodayResponse;
      const value = Boolean(res.ok && data.ok && data.completed_today);
      setCompletedToday(value);
      return value;
    } catch { setCompletedToday(false); return false; }
  }

  async function checkBanner(completedTodayValue: boolean) {
    if (dismissedToday || completedTodayValue || shownToday) return;
    try {
      const res = await fetch("/api/reviews/due-count");
      const data = (await res.json()) as DueCountResponse;
      if (res.ok && data.ok && data.due_count > 0) { setDueCount(data.due_count); setBannerHidden(false); markShownToday(); }
      else setBannerHidden(true);
    } catch { setBannerHidden(true); }
  }

  useEffect(() => {
    (async () => {
      await loadSummary();
      await loadReminder();
      const completed = await loadCompletedToday();
      await checkBanner(completed);
    })();
  }, []);

  async function handleReviewNow() {
    setReviewNowBusy(true);
    const res = await fetch("/api/reviews/first-due");
    const data = (await res.json()) as FirstDueResponse;
    window.location.href = res.ok && data.ok && data.decision_id ? `/reviews?focus=${data.decision_id}` : "/reviews";
    setReviewNowBusy(false);
  }

  function pushMessage(m: ChatMessage) { setMessages((prev) => [...prev, m]); }

  const sendMessage = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    if (inputRef2.current) inputRef2.current.style.height = "auto";
    setStatus("thinking");
    setIsTyping(false);
    pushMessage({ role: "user", text });
    const requestId = makeRequestId();
    try {
      try {
        const alreadyChecked = localStorage.getItem(FIRST_CHAT_CHECK_KEY) === todayLocal();
        if (!alreadyChecked) { const c = await loadCompletedToday(); await checkBanner(c); localStorage.setItem(FIRST_CHAT_CHECK_KEY, todayLocal()); }
      } catch {}
      try { abortChatRef.current?.abort(); } catch {}
      const ac = new AbortController();
      abortChatRef.current = ac;
      setIsTyping(true);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-memori-request-id": requestId },
        body: JSON.stringify({ text, requestId }),
        signal: ac.signal,
      });
      const data = (await res.json()) as ChatResponse;
      setIsTyping(false);
      pushMessage({ role: "assistant", text: data.text ?? "Something went wrong." });
      await loadSummary();
      await loadReminder();
    } catch (err) {
      setIsTyping(false);
      if (!isAbortError(err)) pushMessage({ role: "assistant", text: "Request failed. Please try again." });
    } finally {
      abortChatRef.current = null;
      setStatus("");
      sendingRef.current = false;
    }
  }, []);

  const { voiceState, start: startVoice, stop: stopVoice, isActive: voiceActive } = useDeepgramSTT({
    onTranscript: (text) => {
      setVoiceError(null);
      void sendMessage(text);
    },
    onError: (msg) => {
      setVoiceError(msg);
    },
  });

  function handleMicClick() {
    setVoiceError(null);
    if (voiceActive) {
      stopVoice();
    } else {
      startVoice();
    }
  }

  function micButtonStyle(active: boolean, busy: boolean): React.CSSProperties {
    if (active) {
      return {
        width: 36, height: 36, borderRadius: 12, border: "none",
        background: "linear-gradient(135deg,#f5c84a,#52b8d8)",
        color: "white", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
        boxShadow: "0 0 0 3px rgba(82,184,216,0.30)",
        animation: "morb-pulse 1.6s ease infinite",
      };
    }
    if (busy) {
      return {
        width: 36, height: 36, borderRadius: 12,
        border: "1px solid rgba(182,155,108,0.28)",
        background: "transparent", color: "#c4b49a",
        cursor: "not-allowed",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
      };
    }
    return {
      width: 36, height: 36, borderRadius: 12,
      border: "1px solid rgba(182,155,108,0.28)",
      background: "transparent", color: "#a09078", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
    };
  }

  function micButtonContent() {
    if (voiceState === "listening") return <IconStop />;
    if (voiceState === "connecting" || voiceState === "requesting" || voiceState === "processing") {
      return <MemoriOrb size={24} />;
    }
    return <IconMic />;
  }

  function micButtonTitle() {
    if (voiceState === "listening") return "Stop recording";
    if (voiceState === "connecting") return "Connecting…";
    if (voiceState === "requesting") return "Requesting microphone…";
    if (voiceState === "processing") return "Processing…";
    return "Voice input";
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  const isBusy = status === "thinking";
  const hasMessages = messages.length > 0;
  const userInitial = email ? email.charAt(0).toUpperCase() : "U";
  const firstName = email ? email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1) : "";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        body {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          color: #1a1512;
        }

        .mp-root {
          height: 100vh;
          display: flex;
          overflow: hidden;
          background:
            radial-gradient(ellipse 100% 60% at 50% -8%, rgba(210,178,110,0.26) 0%, transparent 58%),
            radial-gradient(ellipse 50% 50% at 94% 90%,  rgba(155,205,188,0.17) 0%, transparent 52%),
            radial-gradient(ellipse 42% 38% at 6%  88%,  rgba(220,190,145,0.14) 0%, transparent 48%),
            #f5f0e8;
        }

        .mp-sidebar {
          width: 256px;
          min-width: 256px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 18px 12px 16px;
          border-right: 1px solid rgba(185,160,115,0.17);
          background: rgba(248,243,235,0.72);
          backdrop-filter: blur(28px) saturate(170%);
          -webkit-backdrop-filter: blur(28px) saturate(170%);
          overflow-y: auto;
          gap: 2px;
          flex-shrink: 0;
        }
        .mp-sidebar::-webkit-scrollbar { width: 0px; }

        .mp-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100vh;
          overflow: hidden;
        }

        .mp-scroll::-webkit-scrollbar { width: 3px; }
        .mp-scroll::-webkit-scrollbar-track { background: transparent; }
        .mp-scroll::-webkit-scrollbar-thumb { background: rgba(180,155,110,0.25); border-radius: 2px; }

        @keyframes mtd {
          0%,60%,100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes mfadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mslide {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes mcenter {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes morb-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(82,184,216,0.45); }
          50%      { box-shadow: 0 0 0 10px rgba(82,184,216,0); }
        }
        @keyframes mshimmer {
          0%   { background-position: -280px 0; }
          100% { background-position: 280px 0; }
        }

        .m-msg   { animation: mfadein 0.20s ease; }
        .m-slide { animation: mslide 0.24s ease both; }
        .m-center { animation: mcenter 0.40s ease both; }

        .m-shimmer {
          background: linear-gradient(90deg,rgba(185,158,110,0.09) 25%,rgba(185,158,110,0.20) 50%,rgba(185,158,110,0.09) 75%);
          background-size: 280px 100%;
          animation: mshimmer 1.6s ease infinite;
          border-radius: 5px;
        }

        .mp-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 9px;
          text-decoration: none;
          color: #4e4035;
          font-size: 13.5px;
          font-weight: 400;
          border: 1px solid transparent;
          transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
          cursor: pointer;
          position: relative;
        }
        .mp-nav-item:hover {
          background: rgba(255,255,255,0.75);
          border-color: rgba(185,158,110,0.20);
          color: #1a1512;
        }

        .mp-pill {
          padding: 8px 16px;
          border-radius: 100px;
          border: 1px solid rgba(185,158,110,0.26);
          background: rgba(255,255,255,0.62);
          color: #4e4035;
          font-size: 13px;
          font-weight: 400;
          cursor: pointer;
          font-family: inherit;
          transition: all 145ms ease;
          backdrop-filter: blur(6px);
          white-space: nowrap;
        }
        .mp-pill:hover {
          background: rgba(255,255,255,0.96);
          border-color: rgba(158,118,48,0.34);
          color: #1a1512;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(110,75,15,0.10);
        }

        .mp-send:not(:disabled):hover {
          filter: brightness(1.08);
          transform: scale(1.06);
        }
        .mp-send { transition: all 145ms ease; }

        .mp-input-bar {
          border-radius: 22px;
          border: 1.5px solid rgba(182,155,108,0.28);
          background: rgba(255,255,255,0.72);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transition: border-color 170ms ease, box-shadow 170ms ease, background 170ms ease;
          box-shadow: 0 2px 12px rgba(110,75,15,0.07), 0 1px 2px rgba(110,75,15,0.04);
        }
        .mp-input-bar:focus-within {
          border-color: rgba(145,105,38,0.44);
          background: rgba(255,255,255,0.90);
          box-shadow: 0 0 0 3.5px rgba(145,105,38,0.10), 0 6px 28px rgba(110,75,15,0.10);
        }

        .mp-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: #b8a88a;
          padding: 0 10px;
          margin: 10px 0 3px;
        }

        .mp-card {
          border-radius: 11px;
          border: 1px solid rgba(185,158,110,0.18);
          background: rgba(255,255,255,0.52);
          padding: 13px 13px;
          backdrop-filter: blur(8px);
        }
      `}</style>

      <div className="mp-root">

        {/* ═══════════════════ SIDEBAR ═══════════════════ */}
        <aside className="mp-sidebar">

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:9, padding:"2px 8px 14px", borderBottom:"1px solid rgba(185,158,110,0.15)", marginBottom:4 }}>
            <div style={{ width:26, height:26, borderRadius:7, background:"linear-gradient(135deg,#f5c84a,#52b8d8)", flexShrink:0, boxShadow:"0 2px 8px rgba(82,184,216,0.30)" }} />
            <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:17, fontWeight:600, color:"#1a1512", letterSpacing:"-0.2px" }}>Memori</span>
          </div>

          {/* New conversation */}
          <button
            onClick={() => { setMessages([]); setInput(""); }}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:9, border:"1px solid rgba(185,158,110,0.24)", background:"rgba(255,255,255,0.58)", color:"#1a1512", fontSize:13.5, fontWeight:500, cursor:"pointer", fontFamily:"inherit", width:"100%", marginBottom:6, transition:"all 140ms ease" }}
            onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.92)"}
            onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.58)"}
          >
            <IconPlus /> New conversation
          </button>

          {/* Nav */}
          <div className="mp-label">Workspace</div>
          {NAV_ITEMS.map(({ href, label, Icon, desc }, idx) => (
            <a
            
              key={href} href={href}
              className="mp-nav-item m-slide"
              style={{ animationDelay: `${idx * 0.04}s` }}
              onMouseEnter={() => setHoveredNav(href)}
              onMouseLeave={() => setHoveredNav(null)}
            >
              <span style={{
                width:30, height:30, borderRadius:8, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: hoveredNav===href ? "rgba(235,195,80,0.15)" : "rgba(185,158,110,0.09)",
                color: hoveredNav===href ? "#8B6010" : "#7a6850",
                transition:"all 140ms ease",
              }}><Icon /></span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:500, lineHeight:1.2 }}>{label}</div>
                <div style={{ fontSize:11.5, color:"#a09078", marginTop:1.5, lineHeight:1.2 }}>{desc}</div>
              </div>
              <span style={{ color:"#c4b49a", flexShrink:0, opacity: hoveredNav===href ? 1 : 0, transition:"opacity 140ms ease" }}><IconChevronRight /></span>
            </a>
          ))}

          {/* Identity card */}
          <div className="mp-label" style={{ marginTop:12 }}>Identity</div>
          <div className="mp-card">
            {summaryLoading ? (
              <div>{[100,80,60].map((w,i)=>(
                <div key={i} className="m-shimmer" style={{ height:9, marginBottom:7, width:`${w}%` }} />
              ))}</div>
            ) : (
              <p style={{ fontSize:12.5, lineHeight:1.72, color:"#6a5a45" }}>
                {summary || "Start chatting to build your identity profile."}
              </p>
            )}
            <button
              onClick={() => void loadSummary()}
              style={{ display:"flex", alignItems:"center", gap:5, marginTop:9, padding:"4px 10px", borderRadius:100, border:"1px solid rgba(185,158,110,0.22)", background:"transparent", color:"#8a7a62", fontSize:11.5, fontWeight:500, cursor:"pointer", fontFamily:"inherit", transition:"all 140ms ease" }}
            ><IconRefresh /> Refresh</button>
          </div>

          {/* Reviews due */}
          {!bannerHidden && (
            <div className="mp-card" style={{ marginTop:6, background:"rgba(232,246,250,0.68)", borderColor:"rgba(100,175,205,0.22)" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                <div>
                  <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", color:"#2a7a9a", marginBottom:4 }}>⚖️ {dueCount} review{dueCount!==1?"s":""} due</div>
                  <p style={{ fontSize:12, color:"#3a5a68", lineHeight:1.55 }}>Close the loop on decisions.</p>
                </div>
                <button onClick={dismissToday} style={{ background:"none", border:"none", cursor:"pointer", color:"#8aacb8", padding:2, flexShrink:0, marginTop:1 }}><IconX /></button>
              </div>
              <button onClick={() => void handleReviewNow()} disabled={reviewNowBusy} style={{ marginTop:9, width:"100%", padding:"7px", borderRadius:8, border:"none", background:"#2a8ab0", color:"white", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:reviewNowBusy?0.7:1, transition:"opacity 150ms" }}>
                {reviewNowBusy ? "Opening…" : "Review now →"}
              </button>
            </div>
          )}

          {/* Session stats */}
          <div className="mp-label" style={{ marginTop:12 }}>Session</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
            {[{ label:"Messages", value:messages.length }, { label:"Status", value:isBusy?"Thinking":voiceState==="listening"?"Listening":voiceState==="processing"?"Processing":"Ready" }].map(({label,value})=>(
              <div key={label} className="mp-card" style={{ padding:"10px 11px" }}>
                <div style={{ fontSize:10.5, color:"#a09078", marginBottom:3 }}>{label}</div>
                <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:17, fontWeight:600, color:"#1a1512" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* User */}
          <div style={{ marginTop:"auto", paddingTop:14, borderTop:"1px solid rgba(185,158,110,0.14)" }}>
            {!loadingUser && email ? (
              <div style={{ display:"flex", alignItems:"center", gap:9, padding:"4px 8px", borderRadius:9 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#d4a843,#8B6014)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"white", flexShrink:0 }}>{userInitial}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:500, color:"#1a1512", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{email}</div>
                </div>
                <button onClick={() => void signOut()} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11.5, color:"#a09078", fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0 }}>Sign out</button>
              </div>
            ) : !loadingUser && (
              <a href="/login" style={{ display:"block", textAlign:"center", padding:"9px", borderRadius:9, background:"#1a1512", color:"#f5f0e8", fontSize:13, fontWeight:500, textDecoration:"none" }}>Sign in</a>
            )}
          </div>
        </aside>

        {/* ═══════════════════ MAIN ═══════════════════ */}
        <main className="mp-main">

          {/* Reminder toast */}
          {reminder && (
            <div style={{ margin:"14px 32px 0", padding:"11px 16px", borderRadius:11, background:"rgba(255,249,220,0.82)", border:"1px solid rgba(215,175,70,0.26)", backdropFilter:"blur(10px)", display:"flex", gap:9, alignItems:"flex-start", fontSize:13.5, color:"#5a4218", lineHeight:1.6, boxShadow:"0 2px 12px rgba(110,80,10,0.07)" }}>
              <span style={{ fontSize:15, flexShrink:0 }}>💡</span>
              <span>{reminder}</span>
            </div>
          )}

          {/* Voice error toast */}
          {voiceError && (
            <div style={{ margin:"10px 32px 0", padding:"10px 16px", borderRadius:11, background:"rgba(255,235,235,0.90)", border:"1px solid rgba(205,100,100,0.22)", display:"flex", gap:9, alignItems:"center", fontSize:13, color:"#7a2020" }}>
              <span>🎤 {voiceError}</span>
              <button onClick={() => setVoiceError(null)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"#a06060", padding:2 }}><IconX /></button>
            </div>
          )}

          {/* ── EMPTY STATE ── */}
          {!hasMessages && !isTyping ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px 80px" }}>

              <div className="m-center" style={{ animationDelay:"0s", textAlign:"center", marginBottom:40 }}>
                <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"clamp(26px,3.5vw,40px)", fontWeight:500, color:"#1a1512", letterSpacing:"-0.4px", lineHeight:1.18, marginBottom:12 }}>
                  {firstName ? `Good to see you, ${firstName}.` : "What's on your mind?"}
                </h1>
                <p style={{ fontSize:16, color:"#a09078", fontWeight:400, lineHeight:1.6 }}>
                  Ask anything, capture a thought, or log a decision.
                </p>
                {voiceState === "listening" && (
                  <p style={{ fontSize:14, color:"#52b8d8", marginTop:10, fontWeight:500 }}>
                    🎤 Listening… tap the mic button to stop.
                  </p>
                )}
              </div>

              <div className="m-center mp-input-bar" style={{ animationDelay:"0.08s", width:"100%", maxWidth:672, padding:"14px 14px 14px 20px" }}>
                <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={autoResize}
                    onKeyDown={handleKeyDown}
                    placeholder="Tell Memori anything…"
                    rows={1}
                    style={{ flex:1, background:"transparent", border:"none", outline:"none", fontFamily:"'DM Sans',-apple-system,sans-serif", fontSize:15.5, color:"#1a1512", resize:"none", maxHeight:160, lineHeight:1.6, minHeight:26 }}
                  />
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                    <button
                      onClick={handleMicClick}
                      title={micButtonTitle()}
                      disabled={voiceState === "connecting" || voiceState === "requesting" || voiceState === "processing"}
                      style={micButtonStyle(voiceState === "listening", voiceState === "connecting" || voiceState === "requesting" || voiceState === "processing")}
                    >
                      {micButtonContent()}
                    </button>
                    <button
                      className="mp-send"
                      onClick={() => void sendMessage(input)}
                      disabled={isBusy || !input.trim()}
                      style={{ width:36, height:36, borderRadius:12, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", background:(isBusy||!input.trim())?"rgba(182,155,108,0.18)":"linear-gradient(145deg,#c49a2a,#8B6914)", color:(isBusy||!input.trim())?"#c4b49a":"white", boxShadow:(isBusy||!input.trim())?"none":"0 3px 14px rgba(130,100,18,0.32)" }}
                    ><IconSend /></button>
                  </div>
                </div>
              </div>

              <p className="m-center" style={{ animationDelay:"0.14s", fontSize:11.5, color:"#c4b49a", marginTop:9 }}>
                Enter to send · Shift+Enter for new line
              </p>

              <div className="m-center" style={{ animationDelay:"0.20s", display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginTop:26, maxWidth:672 }}>
                {SUGGESTIONS.map((q) => (
                  <button key={q} className="mp-pill" onClick={() => void sendMessage(q)}>{q}</button>
                ))}
              </div>
            </div>

          ) : (

            <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>

              <div className="mp-scroll" style={{ flex:1, overflowY:"auto", padding:"32px 32px 24px", display:"flex", flexDirection:"column", gap:22, maxWidth:780, width:"100%", margin:"0 auto", alignSelf:"stretch" }}>
                {messages.map((m, i) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={i} className="m-msg" style={{ display:"flex", justifyContent:isUser?"flex-end":"flex-start", gap:10, alignItems:"flex-end" }}>
                      {!isUser && (
                        <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#f5c84a,#52b8d8)", flexShrink:0, marginBottom:2, boxShadow:"0 2px 8px rgba(82,184,216,0.28)" }} />
                      )}
                      <div style={{ maxWidth:"78%" }}>
                        <div style={{
                          padding:"11px 17px",
                          borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                          background: isUser ? "linear-gradient(145deg,#2e2118,#1a1512)" : "rgba(255,255,255,0.84)",
                          color: isUser ? "rgba(245,240,232,0.95)" : "#1a1512",
                          fontSize:15, lineHeight:1.7, whiteSpace:"pre-wrap",
                          border: isUser ? "none" : "1px solid rgba(185,158,110,0.18)",
                          boxShadow: isUser ? "0 3px 16px rgba(26,21,18,0.18)" : "0 2px 10px rgba(110,75,15,0.07)",
                          backdropFilter: isUser ? "none" : "blur(8px)",
                        }}>{m.text}</div>
                      </div>
                      {isUser && (
                        <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#d4a843,#8B6014)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"white", flexShrink:0, marginBottom:2 }}>{userInitial}</div>
                      )}
                    </div>
                  );
                })}
                {isTyping && (
                  <div className="m-msg" style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#f5c84a,#52b8d8)", flexShrink:0, boxShadow:"0 2px 8px rgba(82,184,216,0.28)" }} />
                    <div style={{ padding:"11px 17px", borderRadius:"4px 18px 18px 18px", background:"rgba(255,255,255,0.84)", border:"1px solid rgba(185,158,110,0.18)", boxShadow:"0 2px 10px rgba(110,75,15,0.07)" }}>
                      <TypingDots />
                    </div>
                  </div>
                )}
                {voiceState === "listening" && (
                  <div className="m-msg" style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#f5c84a,#52b8d8)", flexShrink:0, boxShadow:"0 2px 8px rgba(82,184,216,0.28)" }} />
                    <div style={{ padding:"11px 17px", borderRadius:"4px 18px 18px 18px", background:"rgba(232,248,255,0.90)", border:"1px solid rgba(82,184,216,0.28)", boxShadow:"0 2px 10px rgba(82,184,216,0.10)", fontSize:14, color:"#2a7a9a" }}>
                      🎤 Listening…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ borderTop:"1px solid rgba(185,158,110,0.14)", padding:"13px 32px 18px", background:"rgba(245,240,232,0.72)", backdropFilter:"blur(20px)" }}>
                <div className="mp-input-bar" style={{ maxWidth:716, margin:"0 auto", padding:"11px 12px 11px 18px" }}>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
                    <textarea
                      ref={inputRef2}
                      value={input} onChange={autoResize} onKeyDown={handleKeyDown}
                      placeholder="Reply to Memori…" rows={1}
                      style={{ flex:1, background:"transparent", border:"none", outline:"none", fontFamily:"'DM Sans',-apple-system,sans-serif", fontSize:15, color:"#1a1512", resize:"none", maxHeight:140, lineHeight:1.6, minHeight:24 }}
                    />
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                      <button
                        onClick={handleMicClick}
                        title={micButtonTitle()}
                        disabled={voiceState === "connecting" || voiceState === "requesting" || voiceState === "processing"}
                        style={micButtonStyle(voiceState === "listening", voiceState === "connecting" || voiceState === "requesting" || voiceState === "processing")}
                      >
                        {micButtonContent()}
                      </button>
                      <button className="mp-send" onClick={() => void sendMessage(input)} disabled={isBusy||!input.trim()} style={{ width:34, height:34, borderRadius:11, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", background:(isBusy||!input.trim())?"rgba(182,155,108,0.18)":"linear-gradient(145deg,#c49a2a,#8B6914)", color:(isBusy||!input.trim())?"#c4b49a":"white", boxShadow:(isBusy||!input.trim())?"none":"0 3px 12px rgba(130,100,18,0.30)" }}>
                        <IconSend />
                      </button>
                    </div>
                  </div>
                </div>
                <p style={{ textAlign:"center", fontSize:11, color:"#c4b49a", marginTop:8 }}>Enter to send · Shift+Enter for new line</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
