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
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
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
