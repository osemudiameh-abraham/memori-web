"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDeepgramSTT } from "@/lib/voice/useDeepgramSTT";

type ChatMessage = { role: "user" | "assistant"; text: string; approved?: "yes" | "no" };
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
function getGreetingPhrase(name: string | null): string {
  const h = new Date().getHours();
  const period = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  if (name) return `Good ${period}, ${name}.`;
  return `Good ${period}.`;
}

const NAV_ITEMS = [
  { href: "/vault",      label: "Memory Vault",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7M12 17v-2M9 12H7M17 12h-2"/></svg> },
  { href: "/facts",      label: "Facts audit",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { href: "/reviews",    label: "Reviews",       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { href: "/digest",     label: "Digest",        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { href: "/trace",      label: "Trace audit",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
  { href: "/onboarding", label: "Onboarding",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
  { href: "/settings",   label: "Settings",      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

const CHIPS = [
  { label: "What do you know about me?", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> },
  { label: "Log a decision", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg> },
  { label: "Review my week", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { label: "What patterns do you see?", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
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
  const [approving, setApproving] = useState<string | null>(null); // tracks which message is being approved
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sendingRef = useRef(false);
  const abortChatRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      return Boolean(res.ok && data.ok && data.completed_today);
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

  useEffect(() => {
    if (!summary) return;
    const match = summary.match(/You(?:'re| are) ([A-Z][a-z]+)/) ?? summary.match(/Your name is ([A-Z][a-z]+)/);
    if (match?.[1]) setSelfName(match[1]);
  }, [summary]);

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


  async function handleApprove(messageIndex: number, approved: boolean) {
    if (approving) return;
    setApproving(String(messageIndex));
    setMessages(prev => {
      const updated = [...prev];
      updated[messageIndex] = { ...updated[messageIndex], approved: approved ? "yes" : "no" };
      return updated;
    });
    await sendMessage(approved ? "yes" : "no");
    setApproving(null);
  }

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

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  const isBusy = status === "thinking";
  const hasMessages = messages.length > 0;
  const userInitial = email ? email.charAt(0).toUpperCase() : "?";
  const greetingPhrase = getGreetingPhrase(selfName);

  const MemoriIcon = ({ size = 42, spinning = false }: { size?: number; spinning?: boolean }) => (
    <img
      src="/memori-icon.png"
      alt="Memori"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        animation: spinning ? "mspin 1.2s linear infinite" : "none",
        flexShrink: 0,
      }}
    />
  );

  const WaveformIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="12" x2="4" y2="12"/>
      <line x1="8" y1="8" x2="8" y2="16"/>
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="16" y1="8" x2="16" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="12"/>
    </svg>
  );

  const SendIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4l0 16M5 11l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;}
        body{
          font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
          -webkit-font-smoothing:antialiased;
          overflow:hidden;
          background:#F5F4F0;
          color:#1C1A18;
        }

        /* ── App shell ── */
        .app{
          height:100vh;
          display:flex;
          overflow:hidden;
          background:
            radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),
            radial-gradient(ellipse 100% 100% at 50% 100%,rgba(240,238,232,0.6) 0%,transparent 70%),
            #F5F4F0;
        }

        /* ── Sidebar ── */
        .sidebar{
          width:48px;
          min-width:48px;
          height:100vh;
          display:flex;
          flex-direction:column;
          align-items:center;
          padding:8px 0 14px;
          background:rgba(242,240,236,0.80);
          border-right:1px solid rgba(0,0,0,0.07);
          gap:1px;
          flex-shrink:0;
          transition:width 200ms ease;
          overflow:hidden;
        }
        .sidebar.expanded{
          width:220px;
          align-items:flex-start;
          padding:8px 8px 14px;
        }

        .sb-btn{
          width:32px;height:32px;
          border-radius:8px;
          border:none;background:transparent;
          cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          color:#6B6865;
          text-decoration:none;
          transition:background 130ms ease,color 130ms ease;
          flex-shrink:0;
          position:relative;
        }
        .sb-btn:hover{background:rgba(0,0,0,0.07);color:#1C1A18;}

        .sb-btn::after{
          content:attr(data-tip);
          position:absolute;
          left:calc(100% + 10px);
          top:50%;transform:translateY(-50%);
          background:#1C1A18;color:#F5F4F0;
          font-family:'DM Sans',sans-serif;
          font-size:12px;padding:5px 9px;
          border-radius:7px;white-space:nowrap;
          pointer-events:none;opacity:0;
          transition:opacity 100ms ease;z-index:99;
        }
        .sidebar:not(.expanded) .sb-btn:hover::after{opacity:1;}

        .sb-new{
          width:32px;height:32px;
          border-radius:16px;
          border:1px solid rgba(0,0,0,0.14);
          background:rgba(255,255,255,0.70);
          cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          color:#3C3A38;
          transition:all 130ms ease;
          flex-shrink:0;
        }
        .sb-new:hover{background:rgba(255,255,255,1);border-color:rgba(0,0,0,0.22);}

        .sb-divider{width:24px;height:1px;background:rgba(0,0,0,0.09);margin:4px 0 3px;flex-shrink:0;}
        .sidebar.expanded .sb-divider{width:100%;}

        .sb-spacer{flex:1;}

        .sb-avatar{
          width:30px;height:30px;
          border-radius:50%;
          background:#1C1A18;color:#F5F4F0;
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:600;
          cursor:pointer;border:none;
          font-family:'DM Sans',sans-serif;
          transition:opacity 130ms ease;
          flex-shrink:0;
        }
        .sb-avatar:hover{opacity:0.80;}
        .sb-avatar::after{
          content:attr(data-tip);
          position:absolute;
          left:calc(100% + 10px);bottom:0;
          background:#1C1A18;color:#F5F4F0;
          font-family:'DM Sans',sans-serif;
          font-size:12px;padding:5px 9px;
          border-radius:7px;white-space:nowrap;
          pointer-events:none;opacity:0;
          transition:opacity 100ms ease;z-index:99;
        }
        .sb-avatar:hover::after{opacity:1;}

        /* ── Main ── */
        .main{flex:1;display:flex;flex-direction:column;min-width:0;height:100vh;overflow:hidden;}

        /* ── Empty state ── */
        .empty{
          flex:1;display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          padding:0 32px 60px;
          min-height:0;
        }

        .greeting-row{
          display:flex;align-items:center;gap:14px;
          margin-bottom:32px;
          animation:gfade 0.5s ease both;
        }
        .greeting-text{
          font-family:'Lora',Georgia,serif;
          font-size:clamp(28px,3.5vw,44px);
          font-weight:400;
          color:#2A2825;
          letter-spacing:-0.5px;
          line-height:1.15;
          white-space:nowrap;
        }

        /* ── Input card ── */
        .input-card{
          width:100%;max-width:680px;
          background:rgba(255,255,255,0.90);
          border-radius:16px;
          border:1px solid rgba(0,0,0,0.09);
          box-shadow:0 2px 18px rgba(0,0,0,0.07),0 1px 3px rgba(0,0,0,0.04);
          padding:16px 18px 14px;
          backdrop-filter:blur(16px);
          animation:gfade 0.5s ease 0.08s both;
          transition:box-shadow 150ms ease,border-color 150ms ease;
        }
        .input-card:focus-within{
          border-color:rgba(0,0,0,0.14);
          box-shadow:0 4px 24px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.05);
        }

        .input-card textarea{
          width:100%;background:transparent;border:none;outline:none;
          font-family:'DM Sans',-apple-system,sans-serif;
          font-size:16px;color:#1C1A18;
          resize:none;line-height:1.58;
          min-height:28px;max-height:160px;
          display:block;
        }
        .input-card textarea::placeholder{color:#B0ADA8;font-weight:300;}

        .card-actions{
          display:flex;align-items:center;
          justify-content:space-between;
          padding-top:12px;
          margin-top:8px;
        }

        .card-left{display:flex;align-items:center;gap:4px;}
        .card-right{display:flex;align-items:center;gap:8px;}

        .card-context{
          font-size:13px;font-weight:400;
          color:#9A9690;
          display:flex;align-items:center;gap:5px;
          cursor:default;user-select:none;
        }

        /* ── Chips ── */
        .chips{
          display:flex;gap:8px;flex-wrap:wrap;
          justify-content:center;
          margin-top:16px;max-width:680px;
          animation:gfade 0.5s ease 0.16s both;
        }

        .chip{
          display:inline-flex;align-items:center;gap:6px;
          padding:0 10px;
          height:32px;
          background:rgb(250,249,245);
          border:0.5px solid rgba(31,30,29,0.15);
          border-radius:8px;
          font-size:14px;font-weight:400;
          color:rgb(61,61,58);
          cursor:pointer;font-family:'DM Sans',sans-serif;
          transition:all 120ms ease;
          white-space:nowrap;
        }
        .chip svg{opacity:0.60;flex-shrink:0;}
        .chip:hover{
          background:rgba(240,238,232,1);
          border-color:rgba(31,30,29,0.22);
          color:#1C1A18;
        }
        .chip:hover svg{opacity:0.9;}

        /* ── Messages ── */
        .messages{
          flex:1;overflow-y:auto;
          padding:28px 0 16px;
          display:flex;flex-direction:column;gap:20px;
          min-height:0;
          width:100%;max-width:680px;
          margin:0 auto;align-self:stretch;
          scroll-behavior:smooth;
        }
        .messages::-webkit-scrollbar{width:3px;}
        .messages::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.10);border-radius:2px;}

        .msg-row{display:flex;}
        .msg-row.user{justify-content:flex-end;}
        .msg-row.assistant{justify-content:flex-start;gap:10px;align-items:flex-start;}

        .assistant-icon{
          width:26px;height:26px;
          flex-shrink:0;margin-top:4px;
        }

        .bubble{
          max-width:82%;
          padding:11px 16px;
          font-size:15px;line-height:1.66;
          white-space:pre-wrap;word-break:break-word;
          animation:mmsg 0.18s ease both;
        }
        .bubble.user{
          background:#1C1A18;color:#F5F4F0;
          border-radius:18px 4px 18px 18px;
        }
        .bubble.assistant{
          background:rgba(255,255,255,0.90);color:#1C1A18;
          border-radius:4px 18px 18px 18px;
          border:1px solid rgba(0,0,0,0.08);
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
        }

        .typing-bubble{
          background:rgba(255,255,255,0.90);
          border:1px solid rgba(0,0,0,0.08);
          border-radius:4px 18px 18px 18px;
          padding:12px 16px;
          display:flex;gap:4px;align-items:center;
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
        }
        .dot{width:5px;height:5px;border-radius:50%;background:#ABABAB;animation:mdot 1.3s ease-in-out infinite;}
        .dot:nth-child(2){animation-delay:0.15s;}
        .dot:nth-child(3){animation-delay:0.30s;}

        /* ── Bottom bar ── */
        .bottom-bar{padding:10px 24px 20px;flex-shrink:0;display:flex;justify-content:center;}

        /* ── Icon buttons ── */
        .icon-btn{
          width:30px;height:30px;
          border-radius:8px;background:transparent;border:none;
          cursor:pointer;color:#8A8785;
          display:flex;align-items:center;justify-content:center;
          transition:background 130ms ease,color 130ms ease;
          flex-shrink:0;
        }
        .icon-btn:hover{background:rgba(0,0,0,0.06);color:#1C1A18;}
        .icon-btn:disabled{opacity:0.35;cursor:not-allowed;}

        .send-btn{
          width:32px;height:32px;
          border-radius:9px;
          background:#1C1A18;border:none;
          cursor:pointer;color:#F5F4F0;
          display:flex;align-items:center;justify-content:center;
          transition:all 140ms ease;flex-shrink:0;
        }
        .send-btn:hover:not(:disabled){background:#3A3835;transform:scale(1.05);}
        .send-btn:disabled{background:rgba(0,0,0,0.12);cursor:not-allowed;transform:none;}

        /* ── Toasts ── */
        .toasts{padding:10px 20px 0;display:flex;flex-direction:column;gap:5px;flex-shrink:0;}

        .toast{
          padding:10px 14px;border-radius:11px;font-size:13.5px;line-height:1.5;
          display:flex;align-items:flex-start;gap:8px;
        }
        .toast-reminder{background:rgba(255,252,224,0.95);border:1px solid rgba(185,165,60,0.18);color:#504010;}
        .toast-error{background:rgba(255,240,240,0.95);border:1px solid rgba(185,60,60,0.18);color:#6A1A1A;}
        .toast-close{background:none;border:none;cursor:pointer;color:inherit;opacity:0.4;margin-left:auto;flex-shrink:0;padding:0;font-size:17px;line-height:1;}
        .toast-close:hover{opacity:0.9;}

        .review-banner{
          padding:10px 14px;border-radius:11px;
          background:rgba(228,244,255,0.96);
          border:1px solid rgba(80,145,200,0.18);
          display:flex;align-items:center;gap:12px;
        }
        .review-text{flex:1;min-width:0;}
        .review-label{font-size:10.5px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#3570A8;margin-bottom:1px;}
        .review-sub{font-size:12.5px;color:#265580;}
        .review-btn{
          background:#1C1A18;color:white;border:none;border-radius:9px;
          padding:6px 12px;font-size:13px;font-weight:500;
          cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;
          transition:background 130ms ease;
        }
        .review-btn:hover{background:#3A3835;}
        .review-btn:disabled{opacity:0.6;cursor:not-allowed;}

        /* ── Mobile nav ── */
        .mobile-nav{
          display:none;
          align-items:center;justify-content:space-between;
          padding:14px 18px;
          flex-shrink:0;
          position:relative;z-index:10;
        }
        .mobile-nav-btn{
          width:42px;height:42px;border-radius:50%;
          background:rgba(255,255,255,0.85);border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          color:#3C3A38;
          box-shadow:0 1px 4px rgba(0,0,0,0.09),0 0 0 1px rgba(0,0,0,0.05);
          transition:all 140ms ease;flex-shrink:0;
        }
        .mobile-nav-btn:hover{background:rgba(255,255,255,1);}
        .mobile-nav-title{
          font-family:'Lora',Georgia,serif;
          font-size:17px;font-weight:500;color:#2A2825;letter-spacing:-0.1px;
        }

        /* ── Mobile menu ── */
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.20);z-index:40;backdrop-filter:blur(2px);animation:gfade2 0.18s ease;}
        .drawer{
          position:fixed;top:0;left:0;bottom:0;
          width:min(285px,82vw);
          background:rgba(244,242,238,0.97);
          backdrop-filter:blur(40px);
          -webkit-backdrop-filter:blur(40px);
          z-index:41;display:flex;flex-direction:column;
          padding:0 0 24px;
          box-shadow:6px 0 30px rgba(0,0,0,0.11);
          animation:dslide 0.22s cubic-bezier(0.32,0,0.18,1);
        }
        @keyframes dslide{from{transform:translateX(-100%);}to{transform:translateX(0);}}

        .drawer-header{
          padding:20px 20px 14px;
          display:flex;align-items:center;gap:10px;
          border-bottom:1px solid rgba(0,0,0,0.07);margin-bottom:6px;
        }
        .drawer-logo-wrap{
          width:30px;height:30px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
        }
        .drawer-title{font-family:'Lora',Georgia,serif;font-size:17px;font-weight:500;color:#2A2825;letter-spacing:-0.1px;}

        .drawer-section{font-size:10.5px;font-weight:600;letter-spacing:0.11em;text-transform:uppercase;color:#AEABA5;padding:10px 20px 3px;}

        .drawer-item{
          display:flex;align-items:center;gap:12px;
          padding:10px 20px;
          color:#3C3A38;text-decoration:none;
          font-size:14.5px;font-weight:400;
          transition:background 120ms ease;
        }
        .drawer-item:hover{background:rgba(0,0,0,0.04);}
        .drawer-item svg{opacity:0.58;flex-shrink:0;}

        .drawer-footer{margin-top:auto;padding:0 14px;}
        .drawer-user{padding:11px 13px;border-radius:11px;background:rgba(0,0,0,0.04);}
        .drawer-email{font-size:13px;color:#3C3A38;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .drawer-signout{
          background:none;border:1px solid rgba(0,0,0,0.13);border-radius:8px;
          padding:7px;font-size:13px;color:#6B6865;
          cursor:pointer;font-family:inherit;width:100%;
          transition:all 130ms ease;
        }
        .drawer-signout:hover{background:rgba(0,0,0,0.05);color:#1C1A18;}

        /* ── Mobile input ── */
        .mobile-input-area{padding:0 14px 24px;flex-shrink:0;position:relative;z-index:10;}
        .mobile-panel{
          background:rgba(255,255,255,0.92);border-radius:20px;
          box-shadow:0 3px 22px rgba(0,0,0,0.10),0 0 0 1px rgba(0,0,0,0.06);
          padding:14px 16px 12px;
          backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        }
        .mobile-placeholder{font-size:16px;color:#B0ADA8;font-weight:300;padding-bottom:10px;letter-spacing:-0.1px;}
        .mobile-textarea{
          width:100%;background:transparent;border:none;outline:none;
          font-family:'DM Sans',sans-serif;font-size:16px;color:#1C1A18;
          resize:none;line-height:1.55;min-height:24px;max-height:130px;display:block;
        }
        .mobile-textarea::placeholder{color:#B0ADA8;font-weight:300;}
        .mobile-actions{display:flex;align-items:center;justify-content:space-between;padding-top:10px;}
        .mobile-right{display:flex;align-items:center;gap:10px;}

        .mobile-icon-btn{background:none;border:none;cursor:pointer;color:#8A8785;display:flex;align-items:center;padding:4px;transition:color 130ms ease;}
        .mobile-icon-btn:hover{color:#1C1A18;}

        .mobile-voice-btn{
          width:38px;height:38px;border-radius:50%;
          background:#1C1A18;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          color:white;transition:all 140ms ease;flex-shrink:0;
        }
        .mobile-voice-btn:hover{background:#3A3835;}
        .mobile-voice-btn.listening{background:linear-gradient(135deg,#5BA8D8,#80C4EC);animation:mpulse 1.8s ease infinite;}
        .mobile-voice-btn:disabled{opacity:0.5;cursor:not-allowed;}

        .mobile-messages{flex:1;overflow-y:auto;padding:20px 16px 12px;display:flex;flex-direction:column;gap:16px;min-height:0;}
        .mobile-messages::-webkit-scrollbar{width:0px;}

        /* ── Mobile empty ── */
        .mobile-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 28px 80px;text-align:center;}
        .mobile-orb{margin-bottom:24px;animation:orbpop 0.55s cubic-bezier(0.34,1.56,0.64,1) both;}
        .mobile-headline{font-family:'Lora',Georgia,serif;font-size:clamp(24px,8vw,32px);font-weight:400;color:#2A2825;line-height:1.22;letter-spacing:-0.3px;animation:gfade 0.4s ease 0.18s both;}

        @media(max-width:700px){
          .sidebar{display:none;}
          .mobile-nav{display:flex;width:100%;flex-shrink:0;}
          .empty,.bottom-bar,.messages{display:none!important;}
          .mobile-input-area,.mobile-messages,.mobile-empty{display:flex!important;}
        }
        @media(min-width:701px){
          .mobile-nav,.mobile-input-area,.mobile-messages,.mobile-empty{display:none!important;}
        }

        /* ── Animations ── */
        @keyframes gfade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes gfade2{from{opacity:0;}to{opacity:1;}}
        @keyframes mmsg{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
        @keyframes mdot{0%,60%,100%{transform:translateY(0);opacity:0.3;}30%{transform:translateY(-4px);opacity:1;}}
        @keyframes mpulse{0%,100%{box-shadow:0 0 0 0 rgba(90,168,216,0.42);}50%{box-shadow:0 0 0 9px rgba(90,168,216,0);}}
        @keyframes orbpop{from{opacity:0;transform:scale(0.65);}to{opacity:1;transform:scale(1);}}
        @keyframes mspin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        @keyframes mlistenpulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
        .listening-wave{animation:mlistenpulse 1.2s ease infinite;}
      `}</style>

      <div className="app">

        {/* ━━━━━ DESKTOP SIDEBAR ━━━━━ */}
        <aside className={`sidebar${sidebarCollapsed ? "" : ""}`}>
          {/* Collapse toggle */}
          <button className="sb-btn" data-tip="Toggle sidebar" onClick={() => setSidebarCollapsed(v => !v)} aria-label="Toggle sidebar" style={{ marginBottom:4 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>

          {/* New chat */}
          <button className="sb-new" data-tip="New conversation" onClick={() => setMessages([])} aria-label="New conversation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          <div className="sb-divider" style={{ margin:"6px 0" }}/>

          {/* Nav items */}
          {NAV_ITEMS.map(({ href, label, icon }) => (
            <a key={href} href={href} className="sb-btn" data-tip={label} aria-label={label}>{icon}</a>
          ))}

          <div className="sb-spacer"/>

          {/* User avatar */}
          {!loadingUser && email ? (
            <button className="sb-avatar" data-tip="Sign out" onClick={() => void signOut()} aria-label="Sign out" style={{ position:"relative" }}>
              {userInitial}
            </button>
          ) : !loadingUser && (
            <a href="/login" className="sb-btn" data-tip="Sign in" aria-label="Sign in">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </a>
          )}
        </aside>

        {/* ━━━━━ MOBILE NAV ━━━━━ */}
        <nav className="mobile-nav">
          <button className="mobile-nav-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Menu">
            <svg width="17" height="13" viewBox="0 0 18 14" fill="none">
              <rect width="18" height="2" rx="1" fill="currentColor"/>
              <rect y="6" width="13" height="2" rx="1" fill="currentColor"/>
              <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>
          <span className="mobile-nav-title">Memori</span>
          <button className="mobile-nav-btn" aria-label="Profile">
            {!loadingUser && email
              ? <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, fontWeight:600, color:"#3C3A38" }}>{userInitial}</span>
              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </button>
        </nav>

        {/* ━━━━━ MOBILE DRAWER ━━━━━ */}
        {mobileMenuOpen && (
          <>
            <div className="overlay" onClick={() => setMobileMenuOpen(false)}/>
            <div className="drawer" role="dialog" aria-modal="true">
              <div className="drawer-header">
                <div className="drawer-logo-wrap">
                  <MemoriIcon size={30}/>
                </div>
                <span className="drawer-title">Memori</span>
              </div>
              <div className="drawer-section">Workspace</div>
              {NAV_ITEMS.map(({ href, label, icon }) => (
                <a key={href} href={href} className="drawer-item" onClick={() => setMobileMenuOpen(false)}>
                  {icon}{label}
                </a>
              ))}
              {summary && (
                <>
                  <div className="drawer-section" style={{ marginTop:8 }}>Identity</div>
                  <p style={{ padding:"6px 20px 0", fontSize:13, color:"#6B6865", lineHeight:1.65 }}>{summary}</p>
                </>
              )}
              <div className="drawer-footer">
                {!loadingUser && email ? (
                  <div className="drawer-user">
                    <div className="drawer-email">{email}</div>
                    <button className="drawer-signout" onClick={() => { void signOut(); setMobileMenuOpen(false); }}>Sign out</button>
                  </div>
                ) : !loadingUser && (
                  <a href="/login" style={{ display:"block", textAlign:"center", padding:"11px", borderRadius:12, background:"#1C1A18", color:"#F5F4F0", fontSize:14, fontWeight:500, textDecoration:"none" }}>Sign in</a>
                )}
              </div>
            </div>
          </>
        )}

        {/* ━━━━━ MAIN ━━━━━ */}
        <main className="main">

          {/* Toasts */}
          <div className="toasts">
            {reminder && (
              <div style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"9px 14px",
                borderRadius:10,
                background:"rgba(255,255,255,0.80)",
                border:"1px solid rgba(0,0,0,0.09)",
                backdropFilter:"blur(12px)",
                fontSize:13.5,
                color:"#4A4845",
                lineHeight:1.45,
              }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#5BA8D8", flexShrink:0, display:"inline-block" }}/>
                <span style={{ flex:1 }}>{reminder}</span>
                <button onClick={() => setReminder(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#ABABAB", fontSize:16, lineHeight:1, padding:0, flexShrink:0 }}>×</button>
              </div>
            )}
            {voiceError && (
              <div style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"9px 14px",
                borderRadius:10,
                background:"rgba(255,240,240,0.90)",
                border:"1px solid rgba(185,60,60,0.15)",
                backdropFilter:"blur(12px)",
                fontSize:13.5,
                color:"#6A1A1A",
                lineHeight:1.45,
              }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#D05050", flexShrink:0, display:"inline-block" }}/>
                <span style={{ flex:1 }}>{voiceError}</span>
                <button onClick={() => setVoiceError(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#ABABAB", fontSize:16, lineHeight:1, padding:0, flexShrink:0 }}>×</button>
              </div>
            )}
            {!bannerHidden && (
              <div className="review-banner">
                <div className="review-text">
                  <div className="review-label">⚖️ {dueCount} review{dueCount !== 1 ? "s" : ""} due</div>
                  <div className="review-sub">Close the loop on your decisions.</div>
                </div>
                <button className="review-btn" onClick={() => void handleReviewNow()} disabled={reviewNowBusy}>
                  {reviewNowBusy ? "Opening…" : "Review →"}
                </button>
                <button onClick={dismissToday} style={{ background:"none", border:"none", cursor:"pointer", color:"#ABABAB", fontSize:17, lineHeight:1, padding:"0 0 0 4px", flexShrink:0 }}>×</button>
              </div>
            )}
          </div>

          {/* ━━━ DESKTOP EMPTY STATE ━━━ */}
          {!hasMessages && !isTyping && (
            <div className="empty">
              {/* Greeting row — icon inline with text */}
              <div className="greeting-row">
                <MemoriIcon size={96} spinning={false}/>
                <h1 className="greeting-text">{greetingPhrase}</h1>
              </div>

              {/* Input card */}
              <div className="input-card">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={autoResize}
                  onKeyDown={handleKeyDown}
                  placeholder="How can I help you today?"
                  rows={1}
                  aria-label="Message input"
                  autoFocus
                />
                <div className="card-actions">
                  <div className="card-left">
                    <button className="icon-btn" aria-label="Attach" title="Attach">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  </div>
                  <div className="card-right">
                    <span className="card-context">Memori</span>
                    {input.trim() ? (
                      <button className="send-btn" onClick={() => void sendMessage(input)} disabled={isBusy} aria-label="Send">
                        <SendIcon/>
                      </button>
                    ) : (
                      <button
                        className="icon-btn"
                        onClick={handleMicClick}
                        disabled={voiceState === "connecting" || voiceState === "requesting" || voiceState === "processing"}
                        aria-label={voiceState === "listening" ? "Stop recording" : "Voice input"}
                        style={{ color: voiceState === "listening" ? "#5BA8D8" : "#8A8785", width:36, height:36, borderRadius:8, background: voiceState === "listening" ? "rgba(91,168,216,0.10)" : "transparent" }}
                      >
                        <span className={voiceState === "listening" ? "listening-wave" : ""}>
                          {voiceState === "listening" ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="4" y1="12" x2="4" y2="12"/><line x1="8" y1="8" x2="8" y2="16"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="16" y1="8" x2="16" y2="16"/><line x1="20" y1="12" x2="20" y2="12"/>
                            </svg>
                          ) : (
                            <WaveformIcon/>
                          )}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Chips */}
              <div className="chips">
                {CHIPS.map(({ label, icon }) => (
                  <button key={label} className="chip" onClick={() => void sendMessage(label)}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ━━━ DESKTOP MESSAGES ━━━ */}
          {(hasMessages || isTyping) && (
            <div className="messages" style={{ flexDirection:"column" }}>
              {messages.map((m, i) => (
                <div key={i} className={`msg-row ${m.role}`}>
                  {m.role === "assistant" && (
                    <div className="assistant-icon">
                      <MemoriIcon size={26} spinning={false}/>
                    </div>
                  )}
                  {m.role === "assistant" && m.text.includes("Should I proceed?") && !m.approved ? (
                    <div className="bubble assistant" style={{ padding:"14px 16px" }}>
                      <div style={{ fontSize:14.5, lineHeight:1.65, marginBottom:14, color:"#1C1A18", whiteSpace:"pre-wrap" }}>{m.text}</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button
                          onClick={() => void handleApprove(i, true)}
                          disabled={!!approving}
                          style={{ padding:"8px 18px", borderRadius:9, border:"none", background:"#1C1A18", color:"#F5F4F0", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, fontWeight:500, cursor:"pointer", opacity:approving?0.6:1, transition:"all 130ms ease" }}
                        >
                          {approving === String(i) ? "…" : "✓ Approve"}
                        </button>
                        <button
                          onClick={() => void handleApprove(i, false)}
                          disabled={!!approving}
                          style={{ padding:"8px 18px", borderRadius:9, border:"1px solid rgba(0,0,0,0.14)", background:"transparent", color:"#6B6865", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, cursor:"pointer", opacity:approving?0.6:1, transition:"all 130ms ease" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : m.approved ? (
                    <div className="bubble assistant" style={{ padding:"14px 16px" }}>
                      <div style={{ fontSize:14, color:"#8A8785", lineHeight:1.55, whiteSpace:"pre-wrap" }}>{m.text}</div>
                      <div style={{ marginTop:10, fontSize:13, fontWeight:500, color: m.approved === "yes" ? "#1A5C32" : "#6B6865" }}>
                        {m.approved === "yes" ? "✓ Approved" : "✗ Cancelled"}
                      </div>
                    </div>
                  ) : (
                    <div className={`bubble ${m.role}`}>{m.text}</div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="msg-row assistant">
                  <div className="assistant-icon">
                    <MemoriIcon size={26} spinning={true}/>
                  </div>
                  <div className="typing-bubble">
                    <span className="dot"/><span className="dot"/><span className="dot"/>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef}/>
            </div>
          )}

          {/* ━━━ DESKTOP BOTTOM INPUT (chat mode) ━━━ */}
          {(hasMessages || isTyping) && (
            <div className="bottom-bar">
              <div className="input-card" style={{ animation:"none" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={autoResize}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply to Memori…"
                  rows={1}
                  aria-label="Message input"
                />
                <div className="card-actions">
                  <div className="card-left">
                    <button className="icon-btn" aria-label="Attach">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  </div>
                  <div className="card-right">
                    <span className="card-context">Memori</span>
                    {input.trim() ? (
                      <button className="send-btn" onClick={() => void sendMessage(input)} disabled={isBusy} aria-label="Send">
                        <SendIcon/>
                      </button>
                    ) : (
                      <button className="icon-btn" onClick={handleMicClick} disabled={voiceState==="connecting"||voiceState==="requesting"||voiceState==="processing"} aria-label="Voice" style={{ color: voiceState === "listening" ? "#5BA8D8" : "#8A8785", width:36, height:36, borderRadius:8 }}>
                        {voiceState === "listening" ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
                        ) : (
                          <WaveformIcon/>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ━━━ MOBILE EMPTY STATE ━━━ */}
          <div className="mobile-empty">
            <div className="mobile-orb"><MemoriIcon size={72}/></div>
            <h1 className="mobile-headline">How can I help you<br/>today?</h1>
          </div>

          {/* ━━━ MOBILE MESSAGES ━━━ */}
          <div className="mobile-messages" style={{ flexDirection:"column" }}>
            {messages.map((m, i) => (
              <div key={i} className={`msg-row ${m.role}`}>
                {m.role === "assistant" && <div className="assistant-icon"><MemoriIcon size={24} spinning={false}/></div>}
                <div className={`bubble ${m.role}`}>{m.text}</div>
              </div>
            ))}
            {isTyping && (
              <div className="msg-row assistant">
                <div className="assistant-icon"><MemoriIcon size={24} spinning={true}/></div>
                <div className="typing-bubble"><span className="dot"/><span className="dot"/><span className="dot"/></div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* ━━━ MOBILE INPUT ━━━ */}
          <div className="mobile-input-area">
            <div className="mobile-panel">
              {!input && !hasMessages && <div className="mobile-placeholder">Chat with Memori</div>}
              <textarea
                value={input}
                onChange={autoResize}
                onKeyDown={handleKeyDown}
                placeholder={hasMessages ? "Reply…" : ""}
                rows={1}
                className="mobile-textarea"
                aria-label="Message input"
              />
              <div className="mobile-actions">
                <button className="mobile-icon-btn" aria-label="Attach">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <div className="mobile-right">
                  {input.trim() && (
                    <button className="send-btn" onClick={() => void sendMessage(input)} disabled={isBusy} aria-label="Send" style={{ width:38, height:38, borderRadius:10 }}>
                      <SendIcon/>
                    </button>
                  )}
                  <button
                    className={`mobile-voice-btn${voiceState === "listening" ? " listening" : ""}`}
                    onClick={handleMicClick}
                    disabled={voiceState==="connecting"||voiceState==="requesting"||voiceState==="processing"}
                    aria-label="Voice"
                  >
                    <WaveformIcon/>
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
