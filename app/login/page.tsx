"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "sent";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle"|"busy"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPass, setShowPass] = useState(false);

  async function handleEmailAuth() {
    const t = email.trim();
    if (!t || !password) { setErrorMsg("Please enter your email and password."); setStatus("error"); return; }
    setStatus("busy"); setErrorMsg("");
    const supabase = createSupabaseBrowserClient();
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email: t, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) { setErrorMsg(error.message); setStatus("error"); return; }
      setMode("sent");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: t, password });
      if (error) { setErrorMsg(error.message); setStatus("error"); return; }
      window.location.href = "/";
    }
    setStatus("idle");
  }

  async function handleMagicLink() {
    const t = email.trim();
    if (!t) { setErrorMsg("Please enter your email."); setStatus("error"); return; }
    setStatus("busy"); setErrorMsg("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({ email: t, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setErrorMsg(error.message); setStatus("error"); return; }
    setMode("sent"); setStatus("idle");
  }

  async function handleGoogle() {
    setStatus("busy"); setErrorMsg("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setErrorMsg(error.message); setStatus("error"); }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleEmailAuth();
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"11px 14px", borderRadius:10,
    border:"1px solid rgba(0,0,0,0.18)",
    background:"rgba(255,255,255,1)",
    fontFamily:"'DM Sans',sans-serif", fontSize:15, color:"#1C1A18",
    outline:"none", transition:"border-color 150ms ease, box-shadow 150ms ease",
    boxShadow:"0 1px 2px rgba(0,0,0,0.04)",
  };

  const TRUST = [
    { icon:"🔒", label:"End-to-end encrypted",    sub:"Your memories are encrypted at rest and in transit" },
    { icon:"👁", label:"You control your data",    sub:"Export or delete everything at any time" },
    { icon:"🚫", label:"Never sold or shared",     sub:"Your data is never used to train external models" },
    { icon:"🛡", label:"SOC 2 aligned practices",  sub:"Built on enterprise-grade Supabase infrastructure" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{min-height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#FAF9F5;color:#1C1A18;}

        /* ── Root layout ── */
        .root{
          min-height:100vh;
          display:grid;
          grid-template-columns:1fr 1fr;
          background:#FAF9F5;
        }
        @media(max-width:720px){
          .root{grid-template-columns:1fr;}
          .trust-panel{display:none!important;}
        }

        /* ── Form panel (left) ── */
        .form-panel{
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          padding:48px 40px;
          min-height:100vh;
        }
        @media(max-width:720px){
          .form-panel{padding:40px 24px;}
        }

        /* ── Card ── */
        .card{
          width:100%;
          max-width:380px;
        }

        /* ── Logo row ── */
        .logo-row{
          display:flex;
          align-items:center;
          gap:11px;
          margin-bottom:40px;
        }
        .logo{width:36px;height:36px;flex-shrink:0;}
        .brand{
          font-family:'Lora',Georgia,serif;
          font-size:20px;
          font-weight:500;
          color:#1C1A18;
          letter-spacing:-0.2px;
        }

        /* ── Headings ── */
        .heading{
          font-family:'Lora',Georgia,serif;
          font-size:24px;
          font-weight:400;
          color:#1C1A18;
          letter-spacing:-0.3px;
          margin-bottom:6px;
          line-height:1.25;
        }
        .sub{
          font-size:14px;
          color:#8A8785;
          line-height:1.55;
          margin-bottom:28px;
        }

        /* ── Google button ── */
        .google-btn{
          width:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          padding:12px 16px;
          border-radius:12px;
          border:1px solid rgba(0,0,0,0.12);
          background:#FFFFFF;
          font-family:'DM Sans',sans-serif;
          font-size:14.5px;
          font-weight:500;
          color:#1C1A18;
          cursor:pointer;
          transition:all 150ms ease;
          margin-bottom:16px;
          box-shadow:0 1px 3px rgba(0,0,0,0.05);
          letter-spacing:-0.1px;
        }
        .google-btn:hover{
          border-color:rgba(0,0,0,0.2);
          box-shadow:0 2px 8px rgba(0,0,0,0.08);
          transform:translateY(-1px);
        }
        .google-btn:active{transform:translateY(0);}
        .google-btn:disabled{opacity:0.55;cursor:not-allowed;transform:none;}

        /* ── Divider ── */
        .divider{
          display:flex;
          align-items:center;
          gap:12px;
          margin-bottom:18px;
        }
        .divider-line{flex:1;height:1px;background:rgba(0,0,0,0.08);}
        .divider-text{font-size:12px;color:#C0BDB8;font-weight:500;letter-spacing:0.3px;}

        /* ── Form fields ── */
        .field-label{
          font-size:13px;
          font-weight:500;
          color:#4A4845;
          margin-bottom:5px;
          display:block;
        }
        .field-wrap{
          position:relative;
          margin-bottom:12px;
        }
        input[type="email"],
        input[type="password"],
        input[type="text"]{
          width:100%;
          padding:11px 14px;
          border-radius:10px;
          border:1px solid rgba(0,0,0,0.12);
          background:#FFFFFF;
          font-family:'DM Sans',sans-serif;
          font-size:14.5px;
          color:#1C1A18;
          transition:border-color 150ms ease,box-shadow 150ms ease;
          outline:none;
          -webkit-appearance:none;
        }
        input[type="email"]:focus,
        input[type="password"]:focus,
        input[type="text"]:focus{
          border-color:rgba(0,0,0,0.3);
          box-shadow:0 0 0 3px rgba(0,0,0,0.05);
        }
        input::placeholder{color:#C0BDB8;}

        .pass-toggle{
          position:absolute;right:12px;top:50%;
          transform:translateY(-50%);
          background:none;border:none;
          cursor:pointer;color:#8A8785;
          font-size:12px;
          font-family:'DM Sans',sans-serif;
          padding:4px;
          transition:color 130ms ease;
        }
        .pass-toggle:hover{color:#1C1A18;}

        /* ── Primary button ── */
        .primary-btn{
          width:100%;
          padding:12px 16px;
          border-radius:12px;
          border:none;
          background:#1C1A18;
          color:#FAFAF8;
          font-family:'DM Sans',sans-serif;
          font-size:15px;
          font-weight:500;
          cursor:pointer;
          transition:all 150ms ease;
          margin-top:4px;
          letter-spacing:-0.1px;
        }
        .primary-btn:hover:not(:disabled){
          background:#2E2C2A;
          transform:translateY(-1px);
          box-shadow:0 4px 12px rgba(0,0,0,0.18);
        }
        .primary-btn:active{transform:translateY(0);}
        .primary-btn:disabled{opacity:0.55;cursor:not-allowed;transform:none;}

        /* ── Magic link button ── */
        .magic-link-btn{
          width:100%;
          padding:11px 16px;
          border-radius:12px;
          border:1px solid rgba(0,0,0,0.10);
          background:transparent;
          color:#4A4845;
          font-family:'DM Sans',sans-serif;
          font-size:14px;
          cursor:pointer;
          transition:all 130ms ease;
          margin-top:8px;
        }
        .magic-link-btn:hover{
          background:#FFFFFF;
          border-color:rgba(0,0,0,0.16);
        }

        /* ── Error box ── */
        .error-box{
          padding:10px 14px;
          border-radius:10px;
          background:rgba(255,240,240,0.95);
          border:1px solid rgba(185,60,60,0.15);
          color:#8B2020;
          font-size:13.5px;
          margin-bottom:12px;
          line-height:1.5;
        }

        /* ── Mode switch ── */
        .mode-switch{
          text-align:center;
          margin-top:22px;
          font-size:13.5px;
          color:#8A8785;
        }
        .mode-link{
          color:#1C1A18;
          font-weight:600;
          cursor:pointer;
          text-decoration:none;
          background:none;
          border:none;
          font-family:inherit;
          font-size:inherit;
          border-bottom:1px solid rgba(0,0,0,0.2);
          padding-bottom:1px;
          transition:border-color 130ms ease;
        }
        .mode-link:hover{border-color:rgba(0,0,0,0.6);}

        /* ── Sent confirmation ── */
        .sent-box{text-align:center;padding:8px 0;}
        .sent-icon{font-size:36px;margin-bottom:14px;}
        .back-home{
          display:block;
          text-align:center;
          margin-top:16px;
          font-size:13.5px;
          color:#8A8785;
          text-decoration:none;
          transition:color 130ms ease;
        }
        .back-home:hover{color:#1C1A18;}

        /* ── Trust panel (right) ── */
        .trust-panel{
          display:flex;
          flex-direction:column;
          justify-content:center;
          padding:60px 56px;
          background:#FFFFFF;
          border-left:1px solid rgba(0,0,0,0.07);
          min-height:100vh;
        }
        .trust-heading{
          font-family:'Lora',Georgia,serif;
          font-size:21px;
          font-weight:500;
          color:#1C1A18;
          letter-spacing:-0.3px;
          margin-bottom:6px;
          line-height:1.3;
        }
        .trust-sub{
          font-size:14px;
          color:#8A8785;
          line-height:1.6;
          margin-bottom:36px;
          max-width:340px;
        }
        .trust-item{
          display:flex;
          gap:16px;
          align-items:flex-start;
          margin-bottom:24px;
          padding-bottom:24px;
          border-bottom:1px solid rgba(0,0,0,0.06);
        }
        .trust-item:last-of-type{border-bottom:none;margin-bottom:0;padding-bottom:0;}
        .trust-icon{
          width:38px;height:38px;
          border-radius:10px;
          background:#FAF9F5;
          border:1px solid rgba(0,0,0,0.07);
          display:flex;align-items:center;justify-content:center;
          font-size:17px;flex-shrink:0;
        }
        .trust-label{
          font-size:14px;font-weight:600;
          color:#1C1A18;margin-bottom:3px;
          letter-spacing:-0.1px;
        }
        .trust-desc{
          font-size:13px;color:#8A8785;line-height:1.55;
        }

        /* ── What Memori remembers box ── */
        .memory-box{
          margin-top:36px;
          padding:18px 20px;
          border-radius:14px;
          background:#FAF9F5;
          border:1px solid rgba(0,0,0,0.07);
        }
        .memory-box-label{
          font-size:11px;font-weight:600;letter-spacing:0.8px;
          color:#B0ADA8;text-transform:uppercase;margin-bottom:8px;
        }
        .memory-box-text{
          font-size:13.5px;color:#4A4845;line-height:1.65;
        }

        /* ── Animations ── */
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        .card{animation:fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;}
        .trust-panel>*{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;}
      `}</style>

      <div className="root">
        {/* Form panel */}
        <div className="form-panel">
          <div className="card">
            {/* Logo */}
            <div className="logo-row">
              <img src="/memori-icon.png" alt="Memori" className="logo" style={{ objectFit:"contain" }}/>
              <span className="brand">Memori</span>
            </div>

            {mode === "sent" ? (
              <div className="sent-box">
                <div className="sent-icon">✉️</div>
                <h1 className="heading">Check your inbox</h1>
                <p className="sub">We sent a secure link to <strong>{email}</strong>.<br/>Click it to sign in — expires in 10 minutes.</p>
                <div style={{ padding:"12px 16px", borderRadius:12, background:"rgba(220,245,230,0.90)", border:"1px solid rgba(30,140,70,0.18)", color:"#1A5C32", fontSize:14 }}>✓ Email sent successfully</div>
                <button className="magic-link-btn" style={{ marginTop:16 }} onClick={() => setMode("signin")}>Use a different email</button>
                <a href="/" className="back-home">← Back to Memori</a>
              </div>
            ) : (
              <>
                <h1 className="heading">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
                <p className="sub">{mode === "signup" ? "Start building your cognitive memory." : "Sign in to continue with Memori."}</p>

                {errorMsg && <div className="error-box">{errorMsg}</div>}

                {/* Google */}
                <button className="google-btn" onClick={() => void handleGoogle()} disabled={status === "busy"}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                    <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="divider">
                  <div className="divider-line"/>
                  <span className="divider-text">or with email</span>
                  <div className="divider-line"/>
                </div>

                {/* Email */}
                <div>
                  <div className="field-label">Email address</div>
                  <div className="field-wrap">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKey} placeholder="you@example.com" autoComplete="email" autoFocus style={inp}/>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="field-label">{mode === "signup" ? "Create a password" : "Password"}</div>
                  <div className="field-wrap">
                    <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} style={{ ...inp, paddingRight:60 }}/>
                    <button className="pass-toggle" onClick={() => setShowPass(v => !v)} type="button">{showPass ? "Hide" : "Show"}</button>
                  </div>
                </div>

                <button className="primary-btn" onClick={() => void handleEmailAuth()} disabled={status === "busy"}>
                  {status === "busy" ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                </button>

                <button className="magic-link-btn" onClick={() => void handleMagicLink()} disabled={status === "busy"}>
                  {status === "busy" ? "Sending…" : "Send magic link instead"}
                </button>

                <div className="mode-switch">
                  {mode === "signin" ? (
                    <>Don't have an account? <button className="mode-link" onClick={() => { setMode("signup"); setErrorMsg(""); }}>Sign up</button></>
                  ) : (
                    <>Already have an account? <button className="mode-link" onClick={() => { setMode("signin"); setErrorMsg(""); }}>Sign in</button></>
                  )}
                </div>

                <a href="/" className="back-home">← Back to Memori</a>
              </>
            )}
          </div>
        </div>

        {/* Trust panel */}
        <div className="trust-panel">
          <div className="trust-heading">Your memory. Your rules.</div>
          <div className="trust-sub">Memori is built on the principle that you own everything stored about you — always.</div>
          {TRUST.map(t => (
            <div key={t.label} className="trust-item">
              <div className="trust-icon">{t.icon}</div>
              <div>
                <div className="trust-label">{t.label}</div>
                <div className="trust-desc">{t.sub}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:12, padding:"14px 16px", borderRadius:12, background:"rgba(255,255,255,0.70)", border:"1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#ABABAB", marginBottom:6 }}>What Memori remembers</div>
            <div style={{ fontSize:13.5, color:"#4A4845", lineHeight:1.60 }}>Decisions you make. Facts about your life. Patterns in your thinking. Everything Memori learns compounds over time — and you can correct, dispute, or delete any of it at any moment.</div>
          </div>
        </div>
      </div>
    </>
  );
}
