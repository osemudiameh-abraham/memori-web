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
    width:"100%", padding:"12px 14px", borderRadius:11,
    border:"1.5px solid rgba(0,0,0,0.12)",
    background:"rgba(255,255,255,0.85)",
    fontFamily:"'DM Sans',sans-serif", fontSize:15, color:"#1C1A18",
    outline:"none", transition:"border-color 150ms ease",
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
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{min-height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#F5F4F0;color:#1C1A18;}
        input:focus{border-color:rgba(0,0,0,0.28)!important;box-shadow:0 0 0 3px rgba(0,0,0,0.06)!important;}
        input::placeholder{color:#B0ADA8;}
        .root{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),#F5F4F0;}
        @media(max-width:700px){.root{grid-template-columns:1fr;}.trust-panel{display:none!important;}}
        .form-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;min-height:100vh;}
        .trust-panel{display:flex;flex-direction:column;justify-content:center;padding:60px 48px;background:rgba(255,255,255,0.55);border-left:1px solid rgba(0,0,0,0.07);}
        .card{width:100%;max-width:400px;}
        .logo-row{display:flex;align-items:center;gap:12px;margin-bottom:32px;}
        .logo{width:44px;height:44px;flex-shrink:0;}
        .brand{font-family:'Lora',Georgia,serif;font-size:22px;font-weight:500;color:#2A2825;letter-spacing:-0.2px;}
        .heading{font-family:'Lora',Georgia,serif;font-size:26px;font-weight:400;color:#2A2825;letter-spacing:-0.3px;margin-bottom:6px;}
        .sub{font-size:14.5px;color:#8A8785;line-height:1.55;margin-bottom:28px;}
        .google-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;border-radius:11px;border:1.5px solid rgba(0,0,0,0.14);background:rgba(255,255,255,0.90);font-family:'DM Sans',sans-serif;font-size:14.5px;font-weight:500;color:#1C1A18;cursor:pointer;transition:all 140ms ease;margin-bottom:16px;}
        .google-btn:hover{background:rgba(255,255,255,1);border-color:rgba(0,0,0,0.22);box-shadow:0 2px 8px rgba(0,0,0,0.07);}
        .google-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .divider{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
        .divider-line{flex:1;height:1px;background:rgba(0,0,0,0.09);}
        .divider-text{font-size:12.5px;color:#ABABAB;}
        .field-label{font-size:13px;font-weight:500;color:#4A4845;margin-bottom:6px;}
        .field-wrap{position:relative;margin-bottom:12px;}
        .pass-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#8A8785;font-size:12px;font-family:'DM Sans',sans-serif;padding:4px;}
        .pass-toggle:hover{color:#1C1A18;}
        .primary-btn{width:100%;padding:13px;border-radius:11px;border:none;background:#1C1A18;color:#F5F4F0;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;transition:all 140ms ease;margin-top:4px;}
        .primary-btn:hover:not(:disabled){background:#3A3835;}
        .primary-btn:disabled{opacity:0.6;cursor:not-allowed;}
        .magic-link-btn{width:100%;padding:10px;border-radius:11px;border:1px solid rgba(0,0,0,0.12);background:transparent;color:#4A4845;font-family:'DM Sans',sans-serif;font-size:13.5px;cursor:pointer;transition:all 130ms ease;margin-top:8px;}
        .magic-link-btn:hover{background:rgba(0,0,0,0.04);}
        .error-box{padding:10px 13px;border-radius:10px;background:rgba(255,240,240,0.95);border:1px solid rgba(185,60,60,0.18);color:#6A1A1A;font-size:13.5px;margin-bottom:12px;}
        .mode-switch{text-align:center;margin-top:20px;font-size:13.5px;color:#8A8785;}
        .mode-link{color:#1C1A18;font-weight:500;cursor:pointer;text-decoration:underline;text-underline-offset:2px;background:none;border:none;font-family:inherit;font-size:inherit;}
        .trust-heading{font-family:'Lora',Georgia,serif;font-size:20px;font-weight:500;color:#2A2825;letter-spacing:-0.2px;margin-bottom:6px;}
        .trust-sub{font-size:14px;color:#8A8785;line-height:1.55;margin-bottom:32px;}
        .trust-item{display:flex;gap:14px;align-items:flex-start;margin-bottom:22px;}
        .trust-icon{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.80);border:1px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
        .trust-label{font-size:14px;font-weight:500;color:#1C1A18;margin-bottom:2px;}
        .trust-desc{font-size:13px;color:#8A8785;line-height:1.50;}
        .sent-box{text-align:center;padding:8px 0;}
        .sent-icon{font-size:40px;margin-bottom:16px;}
        .back-home{display:block;text-align:center;margin-top:16px;font-size:13.5px;color:#8A8785;text-decoration:none;transition:color 130ms ease;}
        .back-home:hover{color:#1C1A18;}
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
