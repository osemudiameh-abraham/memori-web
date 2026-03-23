"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  async function signIn() {
    const supabase = createSupabaseBrowserClient();

    setStatus("Sending magic link...");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Magic link sent. Check your email.");
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1>Login to Memori</h1>

      <div style={{ marginTop: 16 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={() => void signIn()}>Send magic link</button>
      </div>

      {status && <div style={{ marginTop: 12 }}>{status}</div>}
    </main>
  );
}
