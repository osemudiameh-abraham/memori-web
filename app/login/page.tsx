"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function signIn() {
    const trimmed = email.trim();
    if (!trimmed) return;
    const supabase = createSupabaseBrowserClient();
    setStatus("sending");
    setErrorMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void signIn();
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          background: #EFEDE9;
        }

        .l-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          background:
            radial-gradient(ellipse 90% 55% at 50% -5%, rgba(255,255,255,0.95) 0%, transparent 65%),
            radial-gradient(ellipse 55% 55% at 50% 55%, rgba(255,255,255,0.50) 0%, transparent 75%),
            #EFEDE9;
        }

        .l-card {
          width: 100%;
          max-width: 420px;
          background: rgba(255,255,255,0.88);
          border-radius: 24px;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 4px 32px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05);
          padding: 40px 36px 36px;
          backdrop-filter: blur(20px);
          animation: lfade 0.4s ease both;
        }
        @keyframes lfade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .l-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(145deg, #C2DCF2 0%, #89BDE4 55%, #66A8D8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          box-shadow: 0 4px 16px rgba(100,160,210,0.28);
          overflow: hidden;
        }

        .l-heading {
          font-family: 'Lora', Georgia, serif;
          font-size: 26px;
          font-weight: 400;
          color: #2A2825;
          text-align: center;
          letter-spacing: -0.3px;
          margin-bottom: 8px;
        }

        .l-sub {
          font-size: 14.5px;
          color: #8A8780;
          text-align: center;
          line-height: 1.55;
          margin-bottom: 32px;
        }

        .l-label {
          font-size: 13px;
          font-weight: 500;
          color: #4A4843;
          margin-bottom: 7px;
          display: block;
        }

        .l-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1.5px solid rgba(0,0,0,0.12);
          background: rgba(255,255,255,0.80);
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          color: #1C1A18;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease;
          margin-bottom: 16px;
        }
        .l-input::placeholder { color: #ABABAB; }
        .l-input:focus {
          border-color: rgba(100,160,210,0.55);
          box-shadow: 0 0 0 3px rgba(100,160,210,0.12);
        }

        .l-btn {
          width: 100%;
          padding: 13px;
          border-radius: 12px;
          border: none;
          background: #1C1A18;
          color: #F2F1EF;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: background 150ms ease, transform 150ms ease;
          letter-spacing: -0.1px;
        }
        .l-btn:hover:not(:disabled) {
          background: #3A3835;
          transform: translateY(-1px);
        }
        .l-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .l-status {
          margin-top: 16px;
          padding: 12px 16px;
          border-radius: 11px;
          font-size: 14px;
          line-height: 1.5;
          text-align: center;
        }
        .l-status-sent {
          background: rgba(220,245,230,0.90);
          border: 1px solid rgba(60,180,100,0.18);
          color: #1A5C32;
        }
        .l-status-error {
          background: rgba(255,240,240,0.90);
          border: 1px solid rgba(200,60,60,0.18);
          color: #6A1A1A;
        }

        .l-back {
          display: block;
          text-align: center;
          margin-top: 20px;
          font-size: 13.5px;
          color: #8A8780;
          text-decoration: none;
          transition: color 140ms ease;
        }
        .l-back:hover { color: #1C1A18; }
      `}</style>

      <div className="l-root">
        <div className="l-card">
          <div className="l-icon">
            <img
              src="/memori-icon.png"
              alt="Memori"
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <svg
              width="22" height="22" viewBox="0 0 28 28" fill="none"
              style={{ position:"absolute" }}
            >
              <ellipse cx="14" cy="10" rx="5" ry="6" fill="white" opacity="0.95"/>
              <path d="M4 24 Q4.5 17.5 14 17.5 Q23.5 17.5 24 24" fill="white" opacity="0.95"/>
            </svg>
          </div>

          {status !== "sent" ? (
            <>
              <h1 className="l-heading">Welcome to Memori</h1>
              <p className="l-sub">Enter your email and we'll send you a magic link to sign in.</p>

              <label className="l-label" htmlFor="email-input">Email address</label>
              <input
                id="email-input"
                type="email"
                className="l-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="email"
              />

              <button
                className="l-btn"
                onClick={() => void signIn()}
                disabled={status === "sending" || !email.trim()}
              >
                {status === "sending" ? "Sending…" : "Send magic link"}
              </button>

              {status === "error" && (
                <div className="l-status l-status-error">{errorMessage || "Something went wrong. Please try again."}</div>
              )}
            </>
          ) : (
            <>
              <h1 className="l-heading">Check your email</h1>
              <p className="l-sub">We sent a magic link to <strong>{email}</strong>. Click it to sign in — it expires in 10 minutes.</p>
              <div className="l-status l-status-sent">✓ Magic link sent successfully</div>
              <button
                className="l-btn"
                style={{ marginTop:20, background:"transparent", color:"#4A4843", border:"1.5px solid rgba(0,0,0,0.12)" }}
                onClick={() => setStatus("idle")}
              >
                Use a different email
              </button>
            </>
          )}
        </div>

        <a href="/" className="l-back">← Back to Memori</a>
      </div>
    </>
  );
}
