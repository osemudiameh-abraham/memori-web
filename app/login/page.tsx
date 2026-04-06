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
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: t, password });
      if (error) { setErrorMsg(error.message); setStatus("error"); return; }
      if (signInData?.user) {
        const { data: profile } = await supabase.from("identity_profiles").select("id").eq("user_id", signInData.user.id).maybeSingle();
        window.location.href = profile ? "/" : "/onboarding";
      } else {
        window.location.href = "/";
      }
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{min-height:100%;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;background:#FAF9F5;color:#1C1A18;}

        .root{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;background:#FAF9F5;}
        @media(max-width:820px){.root{grid-template-columns:1fr;}.trust-panel{display:none!important;}}

        .form-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;min-height:100vh;position:relative;overflow:hidden;}
        .form-panel::before{content:'';position:absolute;top:-20%;left:50%;transform:translateX(-50%);width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(91,168,216,0.06) 0%,transparent 65%);pointer-events:none;animation:glowPulse 6s ease-in-out infinite;}
        @media(max-width:820px){.form-panel{padding:40px 24px;}}

        .card{width:100%;max-width:400px;position:relative;z-index:1;animation:cardEnter 0.5s cubic-bezier(0.16,1,0.3,1) both;}
        .logo-row{display:flex;align-items:center;gap:11px;margin-bottom:40px;animation:fadeUp 0.4s ease 0.06s both;}
        .logo{width:36px;height:36px;flex-shrink:0;object-fit:contain;}
        .brand{font-family:'Lora',Georgia,serif;font-size:20px;font-weight:500;color:#1C1A18;letter-spacing:-0.2px;}

        .heading{font-family:'Lora',Georgia,serif;font-size:28px;font-weight:400;color:#1C1A18;letter-spacing:-0.4px;margin-bottom:6px;line-height:1.2;animation:fadeUp 0.4s ease 0.10s both;}
        .sub{font-size:15px;color:#8A8785;line-height:1.55;margin-bottom:32px;animation:fadeUp 0.4s ease 0.14s both;}

        .google-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:13px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.10);background:#FFFFFF;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;color:#1C1A18;cursor:pointer;transition:all 180ms ease;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:fadeUp 0.4s ease 0.18s both;}
        .google-btn:hover:not(:disabled){border-color:rgba(0,0,0,0.18);box-shadow:0 2px 12px rgba(0,0,0,0.08);transform:translateY(-1px);}
        .google-btn:active{transform:translateY(0);}.google-btn:disabled{opacity:0.55;cursor:not-allowed;transform:none;}

        .divider{display:flex;align-items:center;gap:16px;margin-bottom:22px;animation:fadeUp 0.4s ease 0.22s both;}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(0,0,0,0.07);}
        .divider span{font-size:12px;color:#C0BDB8;font-weight:500;letter-spacing:0.4px;text-transform:uppercase;}

        .field-label{font-size:13px;font-weight:500;color:#4A4845;margin-bottom:5px;display:block;}
        .field-wrap{position:relative;margin-bottom:14px;}
        .field-input{width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.10);background:#FAFAF8;font-family:'DM Sans',sans-serif;font-size:15px;color:#1C1A18;transition:all 180ms ease;outline:none;-webkit-appearance:none;}
        .field-input:focus{background:#FFFFFF;border-color:rgba(91,168,216,0.40);box-shadow:0 0 0 3px rgba(91,168,216,0.08);}
        .field-input::placeholder{color:#C0BDB8;font-weight:300;}
        .pass-toggle{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#AEABA5;font-size:13px;font-family:'DM Sans',sans-serif;padding:4px;transition:color 130ms ease;}
        .pass-toggle:hover{color:#1C1A18;}
        .form-fields{animation:fadeUp 0.4s ease 0.26s both;}

        .primary-btn{width:100%;padding:13px 16px;border-radius:12px;border:none;background:#1C1A18;color:#FAFAF8;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;transition:all 180ms ease;margin-top:4px;}
        .primary-btn:hover:not(:disabled){background:#2E2C2A;transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.16);}
        .primary-btn:active{transform:translateY(0);}.primary-btn:disabled{opacity:0.50;cursor:not-allowed;transform:none;}

        .magic-btn{width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:transparent;color:#6B6865;font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer;transition:all 160ms ease;margin-top:10px;}
        .magic-btn:hover{background:#FAFAF8;border-color:rgba(0,0,0,0.14);color:#1C1A18;}
        .magic-btn:disabled{opacity:0.50;cursor:not-allowed;}

        .error-box{padding:12px 16px;border-radius:11px;background:rgba(255,240,240,0.90);border:1px solid rgba(200,80,80,0.14);color:#8B2020;font-size:13.5px;margin-bottom:16px;line-height:1.5;animation:fadeUp 0.3s ease both;}

        .mode-switch{text-align:center;margin-top:24px;font-size:13.5px;color:#8A8785;animation:fadeUp 0.4s ease 0.34s both;}
        .mode-link{color:#1C1A18;font-weight:600;cursor:pointer;text-decoration:none;background:none;border:none;font-family:inherit;font-size:inherit;border-bottom:1px solid rgba(0,0,0,0.2);padding-bottom:1px;transition:border-color 130ms ease;}
        .mode-link:hover{border-color:rgba(0,0,0,0.6);}

        .back-home{display:block;text-align:center;margin-top:18px;font-size:13.5px;color:#C0BDB8;text-decoration:none;transition:color 130ms ease;animation:fadeUp 0.4s ease 0.38s both;}
        .back-home:hover{color:#6B6865;}

        .sent-box{text-align:center;padding:16px 0;animation:fadeUp 0.4s ease both;}
        .sent-icon-wrap{width:56px;height:56px;border-radius:50%;background:rgba(91,168,216,0.08);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;animation:checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;}
        .sent-success{padding:12px 16px;border-radius:12px;background:rgba(220,245,230,0.90);border:1px solid rgba(30,140,70,0.15);color:#1A5C32;font-size:14px;margin-top:20px;margin-bottom:16px;}

        .trust-panel{display:flex;flex-direction:column;justify-content:center;padding:60px 56px;background:#FFFFFF;border-left:1px solid rgba(0,0,0,0.06);min-height:100vh;}
        .trust-panel>*{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;}
        .trust-heading{font-family:'Lora',Georgia,serif;font-size:22px;font-weight:500;color:#1C1A18;letter-spacing:-0.3px;margin-bottom:6px;line-height:1.3;animation-delay:0.1s;}
        .trust-sub{font-size:14.5px;color:#8A8785;line-height:1.6;margin-bottom:36px;max-width:340px;animation-delay:0.15s;}

        .trust-item{display:flex;gap:16px;align-items:flex-start;padding:20px 0;border-bottom:1px solid rgba(0,0,0,0.05);}
        .trust-item:last-of-type{border-bottom:none;}
        .trust-icon{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#FAFAF8,#F5F4F0);border:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;transition:all 200ms ease;}
        .trust-item:hover .trust-icon{background:linear-gradient(135deg,rgba(91,168,216,0.08),rgba(91,168,216,0.03));border-color:rgba(91,168,216,0.12);transform:scale(1.04);}
        .trust-label{font-size:14.5px;font-weight:600;color:#1C1A18;margin-bottom:3px;letter-spacing:-0.1px;}
        .trust-desc{font-size:13px;color:#8A8785;line-height:1.55;}

        .memory-box{margin-top:32px;padding:20px;border-radius:16px;background:linear-gradient(135deg,rgba(248,252,255,0.90),rgba(245,250,255,0.60));border:1px solid rgba(91,168,216,0.10);}
        .memory-box-label{font-size:10.5px;font-weight:600;letter-spacing:0.1em;color:#5080A0;text-transform:uppercase;margin-bottom:8px;}
        .memory-box-text{font-size:13.5px;color:#2A6090;line-height:1.65;}

        @keyframes cardEnter{from{opacity:0;transform:translateY(20px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes glowPulse{0%,100%{opacity:0.7;transform:translateX(-50%) scale(1);}50%{opacity:1;transform:translateX(-50%) scale(1.05);}}
        @keyframes checkPop{from{opacity:0;transform:scale(0.5);}to{opacity:1;transform:scale(1);}}
      `}</style>

      <div className="root">
        <div className="form-panel">
          <div className="card">
            <div className="logo-row">
              <img src="/memori-icon.png" alt="Memori" className="logo"/>
              <span className="brand">Memori</span>
            </div>

            {mode === "sent" ? (
              <div className="sent-box">
                <div className="sent-icon-wrap"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5BA8D8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg></div>
                <h1 className="heading" style={{animation:"none"}}>Check your inbox</h1>
                <p className="sub" style={{animation:"none"}}>We sent a secure link to <strong>{email}</strong>.<br/>Click it to sign in.</p>
                <div className="sent-success">Email sent successfully</div>
                <button className="magic-btn" onClick={()=>setMode("signin")}>Use a different email</button>
                <a href="/" className="back-home" style={{animation:"none"}}>← Back to Memori</a>
              </div>
            ) : (
              <>
                <h1 className="heading">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
                <p className="sub">{mode === "signup" ? "Start building your cognitive memory." : "Sign in to continue with Memori."}</p>

                {errorMsg && <div className="error-box">{errorMsg}</div>}

                <button className="google-btn" onClick={()=>void handleGoogle()} disabled={status==="busy"}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  {status==="busy" ? "Connecting..." : "Continue with Google"}
                </button>

                <div className="divider"><span>or with email</span></div>

                <div className="form-fields">
                  <div><label className="field-label">Email address</label><div className="field-wrap"><input type="email" className="field-input" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKey} placeholder="you@example.com" autoComplete="email" autoFocus/></div></div>
                  <div><label className="field-label">{mode==="signup"?"Create a password":"Password"}</label><div className="field-wrap"><input type={showPass?"text":"password"} className="field-input" style={{paddingRight:60}} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={handleKey} placeholder={mode==="signup"?"At least 8 characters":"Your password"} autoComplete={mode==="signup"?"new-password":"current-password"}/><button className="pass-toggle" onClick={()=>setShowPass(v=>!v)} type="button">{showPass?"Hide":"Show"}</button></div></div>
                  <button className="primary-btn" onClick={()=>void handleEmailAuth()} disabled={status==="busy"}>{status==="busy"?"Please wait...":mode==="signup"?"Create account":"Sign in"}</button>
                  <button className="magic-btn" onClick={()=>void handleMagicLink()} disabled={status==="busy"}>{status==="busy"?"Sending...":"Send magic link instead"}</button>
                </div>

                <div className="mode-switch">
                  {mode==="signin"?(<>No account yet? <button className="mode-link" onClick={()=>{setMode("signup");setErrorMsg("");}}>Sign up</button></>):(<>Already have an account? <button className="mode-link" onClick={()=>{setMode("signin");setErrorMsg("");}}>Sign in</button></>)}
                </div>
                <a href="/" className="back-home">← Back to Memori</a>
              </>
            )}
          </div>
        </div>

        <div className="trust-panel">
          <div className="trust-heading">Your memory. Your rules.</div>
          <div className="trust-sub">Memori is built on the principle that you own everything stored about you.</div>
          {[
            {icon:"🔒",label:"End-to-end encrypted",desc:"Your memories are encrypted at rest and in transit"},
            {icon:"👁",label:"You control your data",desc:"Export or delete everything at any time"},
            {icon:"🚫",label:"Never sold or shared",desc:"Your data is never used to train external models"},
            {icon:"🛡",label:"SOC 2 aligned practices",desc:"Built on enterprise-grade Supabase infrastructure"},
          ].map(t=>(
            <div key={t.label} className="trust-item">
              <div className="trust-icon">{t.icon}</div>
              <div><div className="trust-label">{t.label}</div><div className="trust-desc">{t.desc}</div></div>
            </div>
          ))}
          <div className="memory-box">
            <div className="memory-box-label">What Memori remembers</div>
            <div className="memory-box-text">Decisions you make. Facts about your life. Patterns in your thinking. Everything compounds over time, and you can correct, dispute, or delete any of it at any moment.</div>
          </div>
        </div>
      </div>
    </>
  );
}
