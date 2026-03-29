"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type ChatResponse = {
  ok: boolean;
  text?: string;
  error?: string;
};

type IdentitySummaryResponse =
  | {
      ok: true;
      summary: string;
    }
  | {
      ok: false;
      error: string;
    };

type DueCountResponse =
  | { ok: true; due_count: number }
  | { ok: false; error: string };

type CompletedTodayResponse =
  | { ok: true; completed_today: boolean }
  | { ok: false; error: string };

type FirstDueResponse =
  | { ok: true; decision_id: string | null }
  | { ok: false; error: string };

const DISMISS_KEY = "memori_reviews_banner_dismissed_day";
const SHOWN_KEY = "memori_reviews_banner_shown_day";
const FIRST_CHAT_CHECK_KEY = "memori_reviews_checked_on_first_chat_day";

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isAbortError(e: unknown): boolean {
  return !!(e && typeof e === "object" && (e as any).name === "AbortError");
}

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState("Loading identity summary...");
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [dueCount, setDueCount] = useState(0);
  const [bannerHidden, setBannerHidden] = useState(true);
  const [completedToday, setCompletedToday] = useState(false);
  const [reviewNowBusy, setReviewNowBusy] = useState(false);

  const [reminder, setReminder] = useState<string | null>(null);

  const sendingRef = useRef(false);
  const abortChatRef = useRef<AbortController | null>(null);

  const dismissedToday = useMemo(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === todayLocal();
    } catch {
      return true;
    }
  }, []);

  const shownToday = useMemo(() => {
    try {
      return localStorage.getItem(SHOWN_KEY) === todayLocal();
    } catch {
      return true;
    }
  }, []);

  function markShownToday() {
    try {
      localStorage.setItem(SHOWN_KEY, todayLocal());
    } catch {}
  }

  function dismissToday() {
    setBannerHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, todayLocal());
    } catch {}
  }

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

      if (!res.ok || data.ok === false) {
        setSummary("Unable to load identity summary.");
        return;
      }

      setSummary(data.summary);
    } catch {
      setSummary("Unable to load identity summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadReminder() {
    try {
      const res = await fetch("/api/reminders/proactive");
      const data = await res.json();

      if (res.ok && data.ok && data.reminder) {
        setReminder(data.reminder.text);
      } else {
        setReminder(null);
      }
    } catch {
      setReminder(null);
    }
  }

  async function loadCompletedToday(): Promise<boolean> {
    try {
      const res = await fetch("/api/reviews/completed-today");
      const data = (await res.json()) as CompletedTodayResponse;
      const value = Boolean(res.ok && data.ok && data.completed_today);
      setCompletedToday(value);
      return value;
    } catch {
      setCompletedToday(false);
      return false;
    }
  }

  async function checkBanner(completedTodayValue: boolean) {
    if (dismissedToday || completedTodayValue || shownToday) return;

    try {
      const res = await fetch("/api/reviews/due-count");
      const data = (await res.json()) as DueCountResponse;

      if (res.ok && data.ok && data.due_count > 0) {
        setDueCount(data.due_count);
        setBannerHidden(false);
        markShownToday();
      } else {
        setBannerHidden(true);
      }
    } catch {
      setBannerHidden(true);
    }
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

    if (res.ok && data.ok && data.decision_id) {
      window.location.href = `/reviews?focus=${data.decision_id}`;
    } else {
      window.location.href = "/reviews";
    }

    setReviewNowBusy(false);
  }

  function pushMessage(m: ChatMessage) {
    setMessages((prev) => [...prev, m]);
  }

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || sendingRef.current) return;

    sendingRef.current = true;
    setInput("");
    setStatus("Thinking...");
    pushMessage({ role: "user", text });

    const requestId = makeRequestId();

    try {
      try {
        const alreadyChecked = localStorage.getItem(FIRST_CHAT_CHECK_KEY) === todayLocal();
        if (!alreadyChecked) {
          const completed = await loadCompletedToday();
          await checkBanner(completed);
          localStorage.setItem(FIRST_CHAT_CHECK_KEY, todayLocal());
        }
      } catch {
        // ignore
      }

      try {
        abortChatRef.current?.abort();
      } catch {
        // ignore
      }

      const ac = new AbortController();
      abortChatRef.current = ac;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-memori-request-id": requestId,
        },
        body: JSON.stringify({ text, requestId }),
        signal: ac.signal,
      });

      const data = (await res.json()) as ChatResponse;

      pushMessage({
        role: "assistant",
        text: data.text ?? "Error",
      });

      await loadSummary();
      await loadReminder();
    } catch (err) {
      if (!isAbortError(err)) {
        pushMessage({ role: "assistant", text: "Request failed" });
      }
    } finally {
      abortChatRef.current = null;
      setStatus("");
      sendingRef.current = false;
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <main style={{ maxWidth: 860, margin: "40px auto", padding: 16 }}>
      <h1>Memori</h1>

      <div style={{ marginTop: 8 }}>
        {loadingUser ? (
          "Checking login..."
        ) : email ? (
          <>
            Signed in as <strong>{email}</strong>
            <button onClick={() => void signOut()} style={{ marginLeft: 8 }}>
              Sign out
            </button>
          </>
        ) : (
          <>
            Not signed in. <a href="/login">Go to login</a>
          </>
        )}
      </div>

      {reminder && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #ffe58f",
            background: "#fffbe6",
            borderRadius: 8,
          }}
        >
          <strong>Memori</strong>
          <div style={{ marginTop: 6 }}>{reminder}</div>
        </div>
      )}

      {!bannerHidden && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #cfe2ff",
            background: "#e7f1ff",
            borderRadius: 8,
          }}
        >
          <strong>{dueCount} review(s) due</strong>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => void handleReviewNow()} disabled={reviewNowBusy}>
              {reviewNowBusy ? "Opening..." : "Review now"}
            </button>
            <button onClick={dismissToday} style={{ marginLeft: 8 }}>
              Not now
            </button>
          </div>
        </div>
      )}

      <section style={{ marginTop: 16 }}>
        <h3>What Memori knows about you</h3>
        <div>{summaryLoading ? "Loading..." : summary}</div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => void loadSummary()}>Refresh summary</button>
          <button onClick={() => (window.location.href = "/vault")}>Open Vault</button>
          <button onClick={() => (window.location.href = "/facts")}>Facts audit</button>
          <button onClick={() => (window.location.href = "/trace")}>Trace audit</button>
          <button onClick={() => (window.location.href = "/onboarding")}>Onboarding</button>
          <button onClick={() => (window.location.href = "/reviews")}>Reviews</button>
          <button onClick={() => (window.location.href = "/digest")}>Digest</button>
        </div>
      </section>

      <div style={{ marginTop: 20 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.role}:</strong> {m.text}
          </div>
        ))}

        {status && (
          <div style={{ marginTop: 8 }}>
            <em>{status}</em>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (e.repeat) return;
            e.preventDefault();
            void sendMessage(input);
          }}
          style={{ flex: 1 }}
        />
        <button onClick={() => void sendMessage(input)} disabled={sendingRef.current}>
          Send
        </button>
      </div>
    </main>
  );
}