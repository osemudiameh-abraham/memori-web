"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDeepgramSTT } from "@/lib/voice/useDeepgramSTT";

type ChatMessage = { role: "user" | "assistant"; text: string };
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
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function makeRequestId(): string {
  try { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID(); } catch {}
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function isAbortError(e: unknown): boolean {
  return !!(e && typeof e === "object" && (e as {name?:string}).name === "AbortError");
}
function getGreeting(): { time: string; period: string } {
  const h = new Date().getHours();
  if (h < 12) return { time: "morning", period: "morning" };
  if (h < 17) return { time: "afternoon", period: "afternoon" };
  return { time: "evening", period: "evening" };
}

const NAV_ITEMS = [
  { href: "/vault",      label: "Memory Vault",  icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7M12 17v-2M9 12H7M17 12h-2"/></svg> },
  { href: "/facts",      label: "Facts audit",   icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { href: "/reviews",    label: "Reviews",       icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { href: "/digest",     label: "Digest",        icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { href: "/trace",      label: "Trace audit",   icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
  { href: "/onboarding", label: "Onboarding",    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
];

const SUGGESTIONS = [
  { label: "What do you know about me?", icon: "✦" },
  { label: "Log a decision", icon: "⊕" },
  { label: "Review my week", icon: "⟳" },
  { label: "What patterns do you see?", icon: "◈" },
];

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [selfName, setSelfName] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState("");
  const [dueCount, setDueCount] = useState(0);
  const [bannerHidden, setBannerHidden] = useState(true);
  const [reviewNowBusy, setReviewNowBusy] = useState(false);
  const [reminder, setReminder] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const { time: greetingTime } = getGreeting();

  const sendingRef = useRef(false);
  const abortChatRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const desktopInputRef = useRef<HTMLTextAreaElement>(null);

  const dismissedToday = (() => { try { return localStorage.getItem(DISMISS_KEY) === todayLocal(); } catch { return true; } })();
  const shownToday = (() => { try { return localStorage.getItem(SHOWN_KEY) === todayLocal(); } catch { return true; } })();
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
    try {
      const res = await fetch("/api/identity-summary");
      const data = (await res.json()) as IdentitySummaryResponse;
      setSummary(!res.ok || !data.ok ? "" : data.summary);
    } catch { setSummary(""); }
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
      return value;
    } catch { return false; }
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

  // Extract first name from summary for greeting
  // Only match "Your name is X" — never pick up dog/person names
  useEffect(() => {
    if (summary) {
      const match = summary.match(/Your name is ([A-Z][a-z]+)/);
      if (match?.[1]) { setSelfName(match[1]); return; }
    }
    if (email) {
      const raw = email.split("@")[0].split(/[._-]/)[0];
      setSelfName(raw.charAt(0).toUpperCase() + raw.slice(1));
    }
  }, [summary, email]);

  async function handleReviewNow() {
    setReviewNowBusy(true);
    const res = await fetch("/api/reviews/first-due");
    const data = (await res.json()) as FirstDueResponse;
    window.location.href = res.ok && data.ok && data.decision_id ? `/reviews?focus=${data.decision_id}` : "/reviews";
    setReviewNowBusy(false);
  }

  function pushMessage(m: ChatMessage) { setMessages(prev => [...prev, m]); }

  const sendMessage = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    if (desktopInputRef.current) desktopInputRef.current.style.height = "auto";
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
        body: JSON.stringify({ text, requestId, history: messages.slice(-10).map(m => ({ role: m.role, text: m.text })) }),
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
  }, [messages]);

  const { voiceState, start: startVoice, stop: stopVoice, isActive: voiceActive } = useDeepgramSTT({
    onTranscript: (text) => { setVoiceError(null); void sendMessage(text); },
    onError: (msg) => { setVoiceError(msg); },
  });

  function handleMicClick() {
    setVoiceError(null);
    if (voiceActive) stopVoice(); else startVoice();
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>, ref: React.RefObject<HTMLTextAreaElement | null>) {
    setInput(e.target.value);
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 140) + "px";
    }
  }

  const isBusy = status === "thinking";
  const hasMessages = messages.length > 0;
  const userInitial = email ? email.charAt(0).toUpperCase() : "?";
  const displayName = selfName || (email ? email.split("@")[0] : "");
  const capitalName = displayName ? displayName.charAt(0).toUpperCase() + displayName.slice(1) : "";

  const MicIcon = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  );

  const StopIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="3"/>
    </svg>
  );

  const SendIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: 100%; }
        body {
          height: 100%;
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
          background: #F2F1EF;
        }

        /* ━━━━━━━━━━━━━━━━━━ LAYOUT ━━━━━━━━━━━━━━━━━━ */
        .m-app {
          height: 100vh;
          display: flex;
          overflow: hidden;
          background:
            radial-gradient(ellipse 90% 55% at 50% -5%, rgba(255,255,255,0.95) 0%, transparent 65%),
            radial-gradient(ellipse 55% 55% at 50% 55%, rgba(255,255,255,0.50) 0%, transparent 75%),
            #EFEDE9;
        }

        /* ━━━━━━━━━━━━━━━━━━ DESKTOP SIDEBAR ━━━━━━━━━━━━━━━━━━ */
        .m-sidebar {
          width: 56px;
          min-width: 56px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 0 16px;
          background: rgba(240,238,234,0.70);
          border-right: 1px solid rgba(0,0,0,0.065);
          gap: 2px;
          flex-shrink: 0;
          overflow: hidden;
        }

        .m-sidebar-btn {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #757268;
          text-decoration: none;
          transition: background 140ms ease, color 140ms ease;
          flex-shrink: 0;
          position: relative;
        }
        .m-sidebar-btn:hover {
          background: rgba(0,0,0,0.07);
          color: #1C1A18;
        }
        .m-sidebar-btn.active {
          background: rgba(0,0,0,0.08);
          color: #1C1A18;
        }

        /* tooltip */
        .m-sidebar-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          left: calc(100% + 10px);
          top: 50%;
          transform: translateY(-50%);
          background: #1C1A18;
          color: #F2F1EF;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 400;
          padding: 5px 9px;
          border-radius: 7px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 120ms ease;
          z-index: 50;
        }
        .m-sidebar-btn:hover::after { opacity: 1; }

        .m-sidebar-divider {
          width: 28px;
          height: 1px;
          background: rgba(0,0,0,0.10);
          margin: 4px 0;
          flex-shrink: 0;
        }

        .m-sidebar-spacer { flex: 1; }

        /* user avatar */
        .m-sidebar-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #1C1A18;
          color: #F2F1EF;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          flex-shrink: 0;
          font-family: 'DM Sans', sans-serif;
          transition: opacity 140ms ease;
          position: relative;
        }
        .m-sidebar-avatar:hover { opacity: 0.85; }
        .m-sidebar-avatar::after {
          content: attr(data-tooltip);
          position: absolute;
          left: calc(100% + 10px);
          bottom: 0;
          background: #1C1A18;
          color: #F2F1EF;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          padding: 5px 9px;
          border-radius: 7px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 120ms ease;
          z-index: 50;
        }
        .m-sidebar-avatar:hover::after { opacity: 1; }

        /* ━━━━━━━━━━━━━━━━━━ MAIN AREA ━━━━━━━━━━━━━━━━━━ */
        .m-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100vh;
          overflow: hidden;
          position: relative;
        }

        /* ━━━━━━━━━━━━━━━━━━ EMPTY STATE ━━━━━━━━━━━━━━━━━━ */
        .m-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 24px 40px;
          min-height: 0;
        }

        .m-greeting-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 36px;
          animation: mfade 0.5s ease both;
        }

        .m-greeting-orb {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(145deg, #C2DCF2 0%, #89BDE4 55%, #66A8D8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 3px 14px rgba(100,160,210,0.30);
        }

        .m-greeting-text {
          font-family: 'Lora', Georgia, serif;
          font-size: clamp(28px, 3.2vw, 42px);
          font-weight: 400;
          color: #2A2825;
          letter-spacing: -0.4px;
          line-height: 1.15;
          white-space: nowrap;
        }

        /* ━━━━━━━━━━━━━━━━━━ DESKTOP INPUT CARD ━━━━━━━━━━━━━━━━━━ */
        .m-input-card {
          width: 100%;
          max-width: 680px;
          background: rgba(255,255,255,0.86);
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 2px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
          padding: 16px 18px 14px;
          backdrop-filter: blur(16px);
          animation: mfade 0.5s ease 0.1s both;
          transition: box-shadow 160ms ease, border-color 160ms ease;
        }
        .m-input-card:focus-within {
          border-color: rgba(0,0,0,0.13);
          box-shadow: 0 4px 24px rgba(0,0,0,0.11), 0 1px 3px rgba(0,0,0,0.05);
        }

        .m-input-card textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 15.5px;
          color: #1C1A18;
          resize: none;
          line-height: 1.58;
          min-height: 28px;
          max-height: 140px;
          display: block;
        }
        .m-input-card textarea::placeholder { color: #ABABAB; font-weight: 300; }

        .m-input-card-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid rgba(0,0,0,0.06);
          margin-top: 10px;
        }

        .m-card-left { display: flex; align-items: center; gap: 4px; }
        .m-card-right { display: flex; align-items: center; gap: 6px; }

        .m-card-label {
          font-size: 13.5px;
          font-weight: 400;
          color: #9A9590;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: default;
          user-select: none;
        }

        /* ━━━━━━━━━━━━━━━━━━ SUGGESTION CHIPS ━━━━━━━━━━━━━━━━━━ */
        .m-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 18px;
          max-width: 680px;
          animation: mfade 0.5s ease 0.2s both;
        }

        .m-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: rgba(255,255,255,0.70);
          border: 1px solid rgba(0,0,0,0.10);
          border-radius: 100px;
          font-size: 13.5px;
          font-weight: 400;
          color: #4A4843;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 150ms ease;
          backdrop-filter: blur(8px);
          white-space: nowrap;
        }
        .m-chip:hover {
          background: rgba(255,255,255,0.95);
          border-color: rgba(0,0,0,0.16);
          color: #1C1A18;
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        }

        /* ━━━━━━━━━━━━━━━━━━ MESSAGES ━━━━━━━━━━━━━━━━━━ */
        .m-messages {
          flex: 1;
          overflow-y: auto;
          padding: 28px 0 20px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-height: 0;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          align-self: stretch;
        }
        .m-messages::-webkit-scrollbar { width: 3px; }
        .m-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }

        .m-msg-row { display: flex; }
        .m-msg-row.user { justify-content: flex-end; }
        .m-msg-row.assistant { justify-content: flex-start; }

        .m-bubble {
          max-width: 80%;
          padding: 11px 16px;
          font-size: 15px;
          line-height: 1.65;
          white-space: pre-wrap;
          word-break: break-word;
          animation: mmsg 0.18s ease both;
        }
        .m-bubble.user {
          background: #1C1A18;
          color: #F2F1EF;
          border-radius: 20px 4px 20px 20px;
        }
        .m-bubble.assistant {
          background: rgba(255,255,255,0.88);
          color: #1C1A18;
          border-radius: 4px 20px 20px 20px;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }

        .m-typing-bubble {
          background: rgba(255,255,255,0.88);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 4px 20px 20px 20px;
          padding: 12px 16px;
          display: flex;
          gap: 4px;
          align-items: center;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .m-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #ABABAB;
          animation: mdot 1.3s ease-in-out infinite;
        }
        .m-dot:nth-child(2) { animation-delay: 0.15s; }
        .m-dot:nth-child(3) { animation-delay: 0.30s; }

        /* ━━━━━━━━━━━━━━━━━━ DESKTOP BOTTOM INPUT (chat mode) ━━━━━━━━━━━━━━━━━━ */
        .m-bottom-bar {
          padding: 12px 24px 20px;
          flex-shrink: 0;
          display: flex;
          justify-content: center;
        }

        /* ━━━━━━━━━━━━━━━━━━ BUTTONS ━━━━━━━━━━━━━━━━━━ */
        .m-icon-btn {
          width: 32px; height: 32px;
          border-radius: 9px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #757268;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 140ms ease, color 140ms ease;
          flex-shrink: 0;
        }
        .m-icon-btn:hover { background: rgba(0,0,0,0.07); color: #1C1A18; }
        .m-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .m-send-btn {
          width: 30px; height: 30px;
          border-radius: 8px;
          background: #1C1A18;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #F2F1EF;
          transition: all 150ms ease;
          flex-shrink: 0;
        }
        .m-send-btn:hover:not(:disabled) { background: #3A3835; transform: scale(1.06); }
        .m-send-btn:disabled { background: rgba(0,0,0,0.14); cursor: not-allowed; transform: none; }

        .m-voice-main-btn {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: #1C1A18;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: white;
          transition: all 150ms ease;
          flex-shrink: 0;
        }
        .m-voice-main-btn:hover { background: #3A3835; transform: scale(1.05); }
        .m-voice-main-btn.listening {
          background: linear-gradient(135deg, #5A9FD4, #7BB8E8);
          animation: mpulse 1.8s ease infinite;
        }
        .m-voice-main-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* ━━━━━━━━━━━━━━━━━━ TOASTS & BANNER ━━━━━━━━━━━━━━━━━━ */
        .m-toasts {
          padding: 0 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex-shrink: 0;
        }

        .m-toast {
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13.5px;
          line-height: 1.5;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .m-toast-reminder {
          background: rgba(255,253,225,0.95);
          border: 1px solid rgba(185,160,60,0.18);
          color: #54430D;
        }
        .m-toast-error {
          background: rgba(255,242,242,0.95);
          border: 1px solid rgba(185,60,60,0.18);
          color: #6A1A1A;
        }
        .m-toast-close {
          background: none; border: none; cursor: pointer;
          color: inherit; opacity: 0.45; margin-left: auto;
          flex-shrink: 0; padding: 0; font-size: 17px; line-height: 1;
        }
        .m-toast-close:hover { opacity: 0.9; }

        .m-review-banner {
          padding: 11px 14px;
          border-radius: 12px;
          background: rgba(230,244,255,0.95);
          border: 1px solid rgba(80,145,200,0.18);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .m-review-text { flex: 1; min-width: 0; }
        .m-review-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #3A7AB0; margin-bottom: 1px; }
        .m-review-sub { font-size: 12.5px; color: #2A5A80; }
        .m-review-act-btn {
          background: #1C1A18; color: white; border: none; border-radius: 9px;
          padding: 6px 13px; font-size: 13px; font-weight: 500;
          cursor: pointer; font-family: inherit; white-space: nowrap; flex-shrink: 0;
          transition: background 140ms ease;
        }
        .m-review-act-btn:hover { background: #3A3835; }
        .m-review-act-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ━━━━━━━━━━━━━━━━━━ MOBILE ONLY ━━━━━━━━━━━━━━━━━━ */
        .m-mobile-only { display: none; }
        .m-desktop-only { display: flex; }

        @media (max-width: 700px) {
          .m-sidebar { display: none; }
          .m-mobile-only { display: flex; }
          .m-desktop-only { display: none; }

          .m-app {
            flex-direction: column;
          }

          /* mobile top nav */
          .m-mobile-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 18px;
            flex-shrink: 0;
            position: relative;
            z-index: 10;
          }

          .m-mobile-nav-btn {
            width: 42px; height: 42px;
            border-radius: 50%;
            background: rgba(255,255,255,0.82);
            border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: #3C3A38;
            box-shadow: 0 1px 4px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.05);
            transition: all 150ms ease;
            flex-shrink: 0;
          }
          .m-mobile-nav-btn:hover { background: rgba(255,255,255,1); }

          .m-mobile-nav-title {
            font-family: 'Lora', Georgia, serif;
            font-size: 17px;
            font-weight: 500;
            color: #2A2825;
            letter-spacing: -0.1px;
          }

          /* mobile empty state */
          .m-mobile-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 0 28px 100px;
            text-align: center;
          }

          .m-mobile-orb {
            width: 64px; height: 64px;
            border-radius: 50%;
            background: linear-gradient(145deg, #C2DCF2 0%, #89BDE4 55%, #66A8D8 100%);
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 28px;
            box-shadow: 0 6px 24px rgba(100,160,210,0.32), 0 2px 6px rgba(100,160,210,0.18);
            animation: morb-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
          }
          @keyframes morb-pop {
            from { opacity: 0; transform: scale(0.65); }
            to   { opacity: 1; transform: scale(1); }
          }

          .m-mobile-headline {
            font-family: 'Lora', Georgia, serif;
            font-size: clamp(25px, 8vw, 34px);
            font-weight: 400;
            color: #2A2825;
            line-height: 1.22;
            letter-spacing: -0.3px;
            animation: mfade 0.45s ease 0.18s both;
          }

          /* mobile floating input */
          .m-mobile-input-area {
            padding: 0 14px 26px;
            flex-shrink: 0;
            position: relative;
            z-index: 10;
          }

          .m-mobile-input-panel {
            background: rgba(255,255,255,0.92);
            border-radius: 22px;
            box-shadow: 0 3px 22px rgba(0,0,0,0.11), 0 0 0 1px rgba(0,0,0,0.06);
            padding: 14px 16px 12px;
            backdrop-filter: blur(22px);
            -webkit-backdrop-filter: blur(22px);
          }

          .m-mobile-placeholder {
            font-size: 16px;
            color: #ABABAB;
            font-weight: 300;
            padding-bottom: 10px;
            letter-spacing: -0.1px;
          }

          .m-mobile-textarea {
            width: 100%;
            background: transparent;
            border: none; outline: none;
            font-family: 'DM Sans', sans-serif;
            font-size: 16px;
            color: #1C1A18;
            resize: none;
            line-height: 1.55;
            min-height: 24px;
            max-height: 130px;
            display: block;
          }
          .m-mobile-textarea::placeholder { color: #ABABAB; font-weight: 300; }

          .m-mobile-input-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 10px;
          }

          .m-mobile-plus-btn {
            background: none; border: none; cursor: pointer;
            color: #5C5A57;
            display: flex; align-items: center; justify-content: center;
            padding: 4px;
          }

          .m-mobile-right { display: flex; align-items: center; gap: 10px; }

          .m-mobile-mic-icon-btn {
            background: none; border: none; cursor: pointer;
            color: #757268;
            display: flex; align-items: center;
            padding: 4px;
            transition: color 140ms ease;
          }
          .m-mobile-mic-icon-btn:hover { color: #1C1A18; }

          .m-mobile-voice-btn {
            width: 40px; height: 40px;
            border-radius: 50%;
            background: #1C1A18;
            border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: white;
            transition: all 150ms ease;
            flex-shrink: 0;
          }
          .m-mobile-voice-btn:hover { background: #3A3835; }
          .m-mobile-voice-btn.listening {
            background: linear-gradient(135deg, #5A9FD4, #7BB8E8);
            animation: mpulse 1.8s ease infinite;
          }
          .m-mobile-voice-btn:disabled { opacity: 0.5; cursor: not-allowed; }

          /* mobile messages */
          .m-mobile-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px 16px 12px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-height: 0;
          }
          .m-mobile-messages::-webkit-scrollbar { width: 0px; }
        }

        /* ━━━━━━━━━━━━━━━━━━ MOBILE MENU OVERLAY ━━━━━━━━━━━━━━━━━━ */
        .m-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.20);
          z-index: 40;
          backdrop-filter: blur(3px);
          animation: mfade 0.18s ease;
        }
        .m-drawer {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: min(290px, 82vw);
          background: rgba(244,242,238,0.97);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          z-index: 41;
          display: flex;
          flex-direction: column;
          padding: 0 0 28px;
          box-shadow: 5px 0 30px rgba(0,0,0,0.12);
          animation: mslide 0.22s cubic-bezier(0.32,0,0.18,1);
        }
        @keyframes mslide {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }

        .m-drawer-header {
          padding: 20px 22px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid rgba(0,0,0,0.07);
          margin-bottom: 8px;
        }
        .m-drawer-logo {
          width: 28px; height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, #C2DCF2, #66A8D8);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(100,160,210,0.28);
        }
        .m-drawer-title {
          font-family: 'Lora', Georgia, serif;
          font-size: 17px;
          font-weight: 500;
          color: #2A2825;
          letter-spacing: -0.1px;
        }

        .m-drawer-section-label {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          color: #AEABA5;
          padding: 10px 22px 4px;
        }

        .m-drawer-item {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 11px 22px;
          color: #3C3A38;
          text-decoration: none;
          font-size: 15px;
          font-weight: 400;
          transition: background 130ms ease;
        }
        .m-drawer-item:hover { background: rgba(0,0,0,0.045); }
        .m-drawer-item svg { opacity: 0.60; flex-shrink: 0; }

        .m-drawer-identity {
          padding: 12px 22px 0;
          font-size: 13px;
          color: #6B6965;
          line-height: 1.65;
        }

        .m-drawer-footer {
          margin-top: auto;
          padding: 0 16px;
        }
        .m-drawer-user {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(0,0,0,0.04);
        }
        .m-drawer-user-email {
          font-size: 13px; color: #3C3A38;
          margin-bottom: 8px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .m-drawer-signout {
          background: none;
          border: 1px solid rgba(0,0,0,0.14);
          border-radius: 9px;
          padding: 7px 14px;
          font-size: 13px; color: #6B6965;
          cursor: pointer; font-family: inherit;
          width: 100%;
          transition: all 140ms ease;
        }
        .m-drawer-signout:hover { background: rgba(0,0,0,0.05); color: #1C1A18; }

        /* ━━━━━━━━━━━━━━━━━━ ANIMATIONS ━━━━━━━━━━━━━━━━━━ */
        @keyframes mfade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mmsg {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mdot {
          0%,60%,100% { transform: translateY(0); opacity: 0.3; }
          30%          { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes mpulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(90,159,212,0.42); }
          50%      { box-shadow: 0 0 0 9px rgba(90,159,212,0); }
        }
      `}</style>

      <div className="m-app">

        {/* ━━━━━━━━━━━━━━━━━━ DESKTOP SIDEBAR ━━━━━━━━━━━━━━━━━━ */}
        <aside className="m-sidebar m-desktop-only" style={{ flexDirection:"column" }}>
          {/* New chat */}
          <button
            className="m-sidebar-btn"
            data-tooltip="New conversation"
            onClick={() => setMessages([])}
            aria-label="New conversation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          <div className="m-sidebar-divider" />

          {/* Nav items */}
          {NAV_ITEMS.map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              className="m-sidebar-btn"
              data-tooltip={label}
              aria-label={label}
            >
              {icon}
            </a>
          ))}

          <div className="m-sidebar-spacer" />

          {/* User avatar */}
          {!loadingUser && email ? (
            <button
              className="m-sidebar-avatar"
              data-tooltip={`${email} — Sign out`}
              onClick={() => void signOut()}
              aria-label="Sign out"
            >
              {userInitial}
            </button>
          ) : !loadingUser && (
            <a href="/login" className="m-sidebar-btn" data-tooltip="Sign in" aria-label="Sign in">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </a>
          )}
        </aside>

        {/* ━━━━━━━━━━━━━━━━━━ MOBILE NAV ━━━━━━━━━━━━━━━━━━ */}
        <nav className="m-mobile-only m-mobile-nav" style={{ width:"100%", flexShrink:0 }}>
          <button className="m-mobile-nav-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
            <svg width="17" height="13" viewBox="0 0 18 14" fill="none">
              <rect width="18" height="2" rx="1" fill="currentColor"/>
              <rect y="6" width="13" height="2" rx="1" fill="currentColor"/>
              <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>

          <span className="m-mobile-nav-title">Memori</span>

          <button className="m-mobile-nav-btn" aria-label="Profile">
            {!loadingUser && email ? (
              <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, fontWeight:600, color:"#3C3A38" }}>{userInitial}</span>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            )}
          </button>
        </nav>

        {/* ━━━━━━━━━━━━━━━━━━ MOBILE MENU DRAWER ━━━━━━━━━━━━━━━━━━ */}
        {mobileMenuOpen && (
          <>
            <div className="m-overlay" onClick={() => setMobileMenuOpen(false)} />
            <div className="m-drawer" role="dialog" aria-modal="true">
              <div className="m-drawer-header">
                <div className="m-drawer-logo">
                  <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                    <ellipse cx="14" cy="10" rx="5" ry="6" fill="white" opacity="0.95"/>
                    <path d="M4 24 Q4.5 17.5 14 17.5 Q23.5 17.5 24 24" fill="white" opacity="0.95"/>
                  </svg>
                </div>
                <span className="m-drawer-title">Memori</span>
              </div>

              <div className="m-drawer-section-label">Workspace</div>
              {NAV_ITEMS.map(({ href, label, icon }) => (
                <a key={href} href={href} className="m-drawer-item" onClick={() => setMobileMenuOpen(false)}>
                  {icon}
                  {label}
                </a>
              ))}

              {summary && (
                <>
                  <div className="m-drawer-section-label" style={{ marginTop:8 }}>Identity</div>
                  <div className="m-drawer-identity">{summary}</div>
                </>
              )}

              <div className="m-drawer-footer">
                {!loadingUser && email ? (
                  <div className="m-drawer-user">
                    <div className="m-drawer-user-email">{email}</div>
                    <button className="m-drawer-signout" onClick={() => { void signOut(); setMobileMenuOpen(false); }}>Sign out</button>
                  </div>
                ) : !loadingUser && (
                  <a href="/login" style={{ display:"block", textAlign:"center", padding:"11px", borderRadius:12, background:"#1C1A18", color:"#F2F1EF", fontSize:14, fontWeight:500, textDecoration:"none" }}>Sign in</a>
                )}
              </div>
            </div>
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━━ MAIN ━━━━━━━━━━━━━━━━━━ */}
        <main className="m-main">

          {/* Toasts */}
          <div className="m-toasts" style={{ paddingTop:12 }}>
            {reminder && (
              <div className="m-toast m-toast-reminder">
                <span style={{ fontSize:13, flexShrink:0 }}>💡</span>
                <span style={{ flex:1 }}>{reminder}</span>
              </div>
            )}
            {voiceError && (
              <div className="m-toast m-toast-error">
                <span style={{ fontSize:13, flexShrink:0 }}>🎤</span>
                <span style={{ flex:1 }}>{voiceError}</span>
                <button className="m-toast-close" onClick={() => setVoiceError(null)} aria-label="Dismiss">×</button>
              </div>
            )}
            {!bannerHidden && (
              <div className="m-review-banner">
                <div className="m-review-text">
                  <div className="m-review-label">⚖️ {dueCount} review{dueCount !== 1 ? "s" : ""} due</div>
                  <div className="m-review-sub">Close the loop on your decisions.</div>
                </div>
                <button className="m-review-act-btn" onClick={() => void handleReviewNow()} disabled={reviewNowBusy}>
                  {reviewNowBusy ? "Opening…" : "Review →"}
                </button>
                <button onClick={dismissToday} style={{ background:"none", border:"none", cursor:"pointer", color:"#ABABAB", fontSize:17, lineHeight:1, padding:"0 0 0 6px", flexShrink:0 }}>×</button>
              </div>
            )}
          </div>

          {/* ━━━━━ DESKTOP: EMPTY STATE ━━━━━ */}
          {!hasMessages && !isTyping && (
            <div className="m-empty m-desktop-only" style={{ flexDirection:"column" }}>
              {/* Greeting row: orb + name */}
              <div className="m-greeting-row">
                <div className="m-greeting-orb">
                  <img src="/memori-icon.png" alt="Memori" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} />
                </div>
                <h1 className="m-greeting-text">
                  {capitalName ? `${greetingTime.charAt(0).toUpperCase() + greetingTime.slice(1)}, ${capitalName}` : `Good ${greetingTime}`}
                </h1>
              </div>

              {/* Input card */}
              <div className="m-input-card">
                <textarea
                  ref={desktopInputRef}
                  value={input}
                  onChange={e => autoResize(e, desktopInputRef)}
                  onKeyDown={handleKeyDown}
                  placeholder="How can I help you today?"
                  rows={1}
                  aria-label="Message input"
                  autoFocus
                />
                <div className="m-input-card-actions">
                  <div className="m-card-left">
                    <button className="m-icon-btn" aria-label="Attachments" title="Attachments">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  </div>
                  <div className="m-card-right">
                    <button
                      className="m-icon-btn"
                      onClick={handleMicClick}
                      disabled={voiceState === "connecting" || voiceState === "requesting" || voiceState === "processing"}
                      aria-label={voiceState === "listening" ? "Stop recording" : "Voice input"}
                      title={voiceState === "listening" ? "Stop" : "Voice"}
                    >
                      {voiceState === "listening" ? <StopIcon /> : <MicIcon />}
                    </button>
                    <button
                      className={`m-voice-main-btn${voiceState === "listening" ? " listening" : ""}`}
                      onClick={handleMicClick}
                      disabled={voiceState === "connecting" || voiceState === "requesting" || voiceState === "processing"}
                      aria-label="Voice"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="22"/>
                        <line x1="8" y1="22" x2="16" y2="22"/>
                      </svg>
                    </button>
                    {input.trim() && (
                      <button className="m-send-btn" onClick={() => void sendMessage(input)} disabled={isBusy} aria-label="Send">
                        <SendIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Suggestion chips */}
              <div className="m-chips">
                {SUGGESTIONS.map(({ label }) => (
                  <button key={label} className="m-chip" onClick={() => void sendMessage(label)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ━━━━━ MOBILE: EMPTY STATE ━━━━━ */}
          {!hasMessages && !isTyping && (
            <div className="m-mobile-empty m-mobile-only" style={{ flex:1 }}>
              <div className="m-mobile-orb">
                <img src="/memori-icon.png" alt="Memori" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} />
              </div>
              <h1 className="m-mobile-headline">
                How can I help you<br />{greetingTime === "morning" ? "this morning" : greetingTime === "afternoon" ? "this afternoon" : "this evening"}?
              </h1>
            </div>
          )}

          {/* ━━━━━ DESKTOP + MOBILE: MESSAGES ━━━━━ */}
          {(hasMessages || isTyping) && (
            <>
              {/* Desktop messages */}
              <div className="m-messages m-desktop-only" style={{ flexDirection:"column", padding:"28px 0 20px" }}>
                {messages.map((m, i) => (
                  <div key={i} className={`m-msg-row ${m.role}`}>
                    <div className={`m-bubble ${m.role}`}>{m.text}</div>
                  </div>
                ))}
                {isTyping && (
                  <div className="m-msg-row assistant">
                    <div className="m-typing-bubble">
                      <span className="m-dot"/><span className="m-dot"/><span className="m-dot"/>
                    </div>
                  </div>
                )}
                {voiceState === "listening" && (
                  <div className="m-msg-row assistant">
                    <div className="m-bubble assistant" style={{ background:"rgba(230,244,255,0.90)", borderColor:"rgba(80,145,200,0.18)", color:"#2A5A80", fontSize:14 }}>🎤 Listening…</div>
                  </div>
                )}
                <div ref={messagesEndRef}/>
              </div>

              {/* Mobile messages */}
              <div className="m-mobile-messages m-mobile-only" style={{ flexDirection:"column" }}>
                {messages.map((m, i) => (
                  <div key={i} className={`m-msg-row ${m.role}`}>
                    <div className={`m-bubble ${m.role}`}>{m.text}</div>
                  </div>
                ))}
                {isTyping && (
                  <div className="m-msg-row assistant">
                    <div className="m-typing-bubble">
                      <span className="m-dot"/><span className="m-dot"/><span className="m-dot"/>
                    </div>
                  </div>
                )}
                {voiceState === "listening" && (
                  <div className="m-msg-row assistant">
                    <div className="m-bubble assistant" style={{ background:"rgba(230,244,255,0.90)", borderColor:"rgba(80,145,200,0.18)", color:"#2A5A80", fontSize:14 }}>🎤 Listening…</div>
                  </div>
                )}
                <div ref={messagesEndRef}/>
              </div>
            </>
          )}

          {/* ━━━━━ DESKTOP: BOTTOM INPUT (chat mode) ━━━━━ */}
          {(hasMessages || isTyping) && (
            <div className="m-bottom-bar m-desktop-only">
              <div className="m-input-card" style={{ animation:"none" }}>
                <textarea
                  ref={desktopInputRef}
                  value={input}
                  onChange={e => autoResize(e, desktopInputRef)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply to Memori…"
                  rows={1}
                  aria-label="Message input"
                />
                <div className="m-input-card-actions">
                  <div className="m-card-left">
                    <button className="m-icon-btn" aria-label="Attachments">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  </div>
                  <div className="m-card-right">
                    <button className="m-icon-btn" onClick={handleMicClick} disabled={voiceState==="connecting"||voiceState==="requesting"||voiceState==="processing"} aria-label="Voice">
                      {voiceState === "listening" ? <StopIcon /> : <MicIcon />}
                    </button>
                    <button className={`m-voice-main-btn${voiceState==="listening"?" listening":""}`} onClick={handleMicClick} disabled={voiceState==="connecting"||voiceState==="requesting"||voiceState==="processing"} aria-label="Voice">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="22"/>
                      </svg>
                    </button>
                    {input.trim() && (
                      <button className="m-send-btn" onClick={() => void sendMessage(input)} disabled={isBusy} aria-label="Send">
                        <SendIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ━━━━━ MOBILE: FLOATING INPUT (always visible) ━━━━━ */}
          <div className="m-mobile-input-area m-mobile-only">
            <div className="m-mobile-input-panel">
              {!input && !hasMessages && (
                <div className="m-mobile-placeholder">Chat with Memori</div>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => autoResize(e, inputRef)}
                onKeyDown={handleKeyDown}
                placeholder={hasMessages ? "Reply…" : ""}
                rows={1}
                className="m-mobile-textarea"
                aria-label="Message input"
              />
              <div className="m-mobile-input-actions">
                <button className="m-mobile-plus-btn" aria-label="Attachments">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <div className="m-mobile-right">
                  {input.trim() && (
                    <button className="m-send-btn" onClick={() => void sendMessage(input)} disabled={isBusy} aria-label="Send" style={{ width:38, height:38, borderRadius:10 }}>
                      <SendIcon />
                    </button>
                  )}
                  <button className="m-mobile-mic-icon-btn" onClick={handleMicClick} disabled={voiceState==="connecting"||voiceState==="requesting"||voiceState==="processing"} aria-label="Voice">
                    {voiceState === "listening" ? <StopIcon /> : <MicIcon />}
                  </button>
                  <button className={`m-mobile-voice-btn${voiceState==="listening"?" listening":""}`} onClick={handleMicClick} disabled={voiceState==="connecting"||voiceState==="requesting"||voiceState==="processing"} aria-label="Voice">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="22"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </>
  );
}
