"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

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

  function sendMessage() {
    const text = input.trim();
    if (!text) return;

    setMessages((m) => [...m, { role: "user", text }]);
    setMessages((m) => [
      ...m,
      { role: "assistant", text: "Memori is not connected yet." },
    ]);
    setInput("");
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
            Signed in as <strong>{email}</strong>{" "}
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
          minHeight: 200,
          marginTop: 16,
        }}
      >
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.role === "user" ? "You" : "Memori"}:</strong> {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </main>
  );
}
