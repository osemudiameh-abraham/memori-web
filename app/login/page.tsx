"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const StarLogo = () => (
  <svg width="56" height="56" viewBox="0 0 100 100" fill="none">
    <path d="M50 5C50 5 54 35 70 50C54 65 50 95 50 95C50 95 46 65 30 50C46 35 50 5 50 5Z" fill="#1558D6"/>
    <path d="M5 50C5 50 35 46 50 30C65 46 95 50 95 50C95 50 65 54 50 70C35 54 5 50 5 50Z" fill="#4285F4"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8H6.4C9.7 35.6 16.3 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C42.7 36.4 44 31.1 44 24c0-1.3-.1-2.6-.4-3.9z"/>
  </svg>
);

type Mode = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const supabase = createSupabaseBrowserClient();

  const handleGoogle = async () => {
    setMode("sending");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) { setErrorMsg(error.message); setMode("error"); }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = email.trim();
    if (!t) { setErrorMsg("Please enter your email."); setMode("error"); return; }
    setMode("sending"); setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: t,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) { setErrorMsg(error.message); setMode("error"); }
    else setMode("sent");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      fontFamily: "var(--font)",
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px",
      }}
      className="hidden md:flex"
      >
        <StarLogo />
        <div style={{ height: 24 }} />
        <h1 style={{ fontSize: 40, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Seven</h1>
        <p style={{ fontSize: 18, color: "var(--text-secondary)", textAlign: "center", maxWidth: 280, lineHeight: 1.5 }}>
          The AI that never forgets you
        </p>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}>
        <div style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
          padding: "48px 40px",
          width: "100%",
          maxWidth: 400,
        }}>
          {/* Mobile logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, justifyContent: "center" }} className="flex md:hidden">
            <StarLogo />
            <span style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)" }}>Seven</span>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>
            Sign in to continue with Seven
          </p>

          {mode === "sent" ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
              <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>Check your email</p>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>We sent a sign-in link to <strong>{email}</strong></p>
            </div>
          ) : (
            <>
              {/* Google sign in */}
              <button
                onClick={handleGoogle}
                disabled={mode === "sending"}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: "var(--radius-pill)",
                  padding: "12px 20px",
                  fontSize: 14, fontWeight: 500,
                  color: "var(--text-primary)",
                  background: "var(--surface)",
                  cursor: mode === "sending" ? "not-allowed" : "pointer",
                  marginBottom: 20,
                  transition: "background var(--transition)",
                  opacity: mode === "sending" ? 0.6 : 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8f8f8")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.1)" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>or use email</span>
                <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.1)" }} />
              </div>

              {/* Magic link form */}
              <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: "100%",
                    border: "1px solid rgba(0,0,0,0.15)",
                    borderRadius: "var(--radius-pill)",
                    padding: "12px 18px",
                    fontSize: 14, color: "var(--text-primary)",
                    outline: "none",
                    background: "var(--surface)",
                    transition: "border-color var(--transition)",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--blue)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)")}
                />
                {(mode === "error" && errorMsg) && (
                  <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>{errorMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={mode === "sending"}
                  style={{
                    background: "var(--blue)",
                    color: "#fff",
                    borderRadius: "var(--radius-pill)",
                    padding: "12px 20px",
                    fontSize: 14, fontWeight: 500,
                    cursor: mode === "sending" ? "not-allowed" : "pointer",
                    opacity: mode === "sending" ? 0.7 : 1,
                    transition: "opacity var(--transition)",
                  }}
                >
                  {mode === "sending" ? "Sending…" : "Send sign-in link"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
