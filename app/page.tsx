"use client";

import { useEffect, useRef, useState } from "react";
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
      snapshot: {
        self_name: string | null;
        self_company: string | null;
        self_role: string | null;
        self_city: string | null;
        self_timezone: string | null;
        dog_name: string | null;
        james_relation: string | null;
        james_role: string | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

function makeRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }

  const rand = Math.random().toString(16).slice(2);
  const ts = Date.now().toString(16);
  return `req_${ts}_${rand}`;
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

  const sendingRef = useRef(false);
  const abortChatRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        setEmail(user?.email ?? null);
      } finally {
        setLoadingUser(false);
      }
    }

    void loadUser();
  }, []);

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/identity-summary", {
        method: "GET",
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as IdentitySummaryResponse;

      if (!res.ok || data.ok === false) {
        setSummary("Unable to load identity summary yet.");
        return;
      }

      setSummary(data.summary);
    } catch {
      setSummary("Unable to load identity summary yet.");
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  function pushMessage(message: ChatMessage) {
    setMessages((m) => [...m, message]);
  }

  async function sendMessage(raw: string) {
    const text = String(raw ?? "").trim();
    if (!text) return;
    if (sendingRef.current) return;

    sendingRef.current = true;
    setStatus("Thinking...");
    setInput("");
    pushMessage({ role: "user", text });

    try {
      abortChatRef.current?.abort();
    } catch {
      // ignore
    }

    const ac = new AbortController();
    abortChatRef.current = ac;
    const requestId = makeRequestId();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-memori-request-id": requestId,
        },
        body: JSON.stringify({ text, requestId }),
        signal: ac.signal,
      });

      const data = (await res.json().catch(() => ({}))) as ChatResponse;

      if (!res.ok || data.ok === false) {
        pushMessage({ role: "assistant", text: data.error ?? "Chat error" });
        return;
      }

      pushMessage({
        role: "assistant",
        text: data.text ?? "(No response)",
      });

      await loadSummary();
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      const msg = err instanceof Error ? err.message : "Chat request failed";
      pushMessage({ role: "assistant", text: msg });
    } finally {
      setStatus("");
      abortChatRef.current = null;
      sendingRef.current = false;
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <main style={{ maxWidth: 820, margin: "40px auto", padding: 16 }}>
      <h1>Memori</h1>

      <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
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

      <section
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 8,
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700 }}>What Memori knows about you</div>
            <div style={{ marginTop: 8, opacity: 0.9 }}>
              {summaryLoading ? "Loading..." : summary}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <button onClick={() => void loadSummary()}>Refresh summary</button>
            <button onClick={() => (window.location.href = "/facts")}>Facts audit</button>
            <button onClick={() => (window.location.href = "/trace")}>Trace audit</button>
          </div>
        </div>
      </section>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 12,
          minHeight: 240,
          marginTop: 16,
        }}
      >
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.role === "user" ? "You" : "Memori"}:</strong> {m.text}
          </div>
        ))}
        {status && (
          <div>
            <em>{status}</em>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
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
