"use client";

import { useState } from "react";

type OnboardingResponse = { ok: true; stored_raw_fact_count: number; canonical_fact_count: number } | { ok: false; error: string };

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(0);
  const [values, setValues] = useState<Record<string,string>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{raw:number;canonical:number}|null>(null);

  function set(key: string, val: string) { setValues(v => ({ ...v, [key]: val })); }

  async function finish() {
    setBusy(true); setErrorMsg("");
    try {
      const res = await fetch("/api/onboarding", {
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          name: values.name??"", city: values.city??"", timezone: values.timezone??"",
          company: values.company??"", role: values.role??"",
          relationshipLabel: values.relationshipLabel??"", relationshipName: values.relationshipName??"",
          petType: values.petType??"", petName: values.petName??"",
          currentGoal: values.currentGoal??"", importantPreference: values.importantPreference??"",
        }),
      });
      const data = (await res.json().catch(()=>({}))) as OnboardingResponse;
      if (!res.ok || data.ok===false) { setErrorMsg(data.ok===false?data.error:"Onboarding failed"); setBusy(false); return; }
      setResult({ raw:data.stored_raw_fact_count, canonical:data.canonical_fact_count });
      setStep(5);
    } catch(e:unknown) { setErrorMsg(e instanceof Error?e.message:"Onboarding failed"); }
    finally { setBusy(false); }
  }

  function next() { setStep(s => Math.min(s+1, 4) as Step); }
  function back() { setStep(s => Math.max(s-1, 0) as Step); }

  const progress = step === 5 ? 100 : Math.round((step / 4) * 100);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{min-height:100%;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;background:#FAF9F5;color:#1C1A18;}

        .ob-root{
          min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:40px 20px 60px;background:#FAF9F5;position:relative;overflow:hidden;
        }
        .ob-root::before{
          content:'';position:absolute;top:-14%;left:50%;transform:translateX(-50%);
          width:600px;height:600px;border-radius:50%;
          background:radial-gradient(circle,rgba(91,168,216,0.07) 0%,rgba(91,168,216,0.02) 40%,transparent 70%);
          pointer-events:none;animation:glowPulse 6s ease-in-out infinite;
        }
        .ob-card{
          width:100%;max-width:500px;background:#FFFFFF;border-radius:24px;
          border:1px solid rgba(0,0,0,0.06);
          box-shadow:0 0 0 1px rgba(0,0,0,0.02),0 4px 16px rgba(0,0,0,0.04),0 12px 48px rgba(0,0,0,0.04);
          padding:40px 40px 36px;position:relative;z-index:1;
          animation:cardEnter 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .ob-logo{display:flex;align-items:center;gap:10px;margin-bottom:28px;animation:fadeUp 0.4s ease 0.06s both;}
        .ob-logo img{width:32px;height:32px;object-fit:contain;}
        .ob-brand{font-family:'Lora',Georgia,serif;font-size:18px;font-weight:500;color:#1C1A18;letter-spacing:-0.2px;}
        .ob-step-label{margin-left:auto;font-size:12px;color:#C0BDB8;font-weight:400;}
        .ob-progress{width:100%;height:3px;background:rgba(0,0,0,0.06);border-radius:2px;margin-bottom:32px;overflow:hidden;animation:fadeUp 0.4s ease 0.10s both;}
        .ob-progress-fill{height:100%;background:linear-gradient(90deg,#1C1A18,#3C3A38);border-radius:2px;transition:width 500ms cubic-bezier(0.16,1,0.3,1);}
        .ob-label{font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:#C0BDB8;margin-bottom:8px;animation:fadeUp 0.4s ease 0.12s both;}
        .ob-heading{font-family:'Lora',Georgia,serif;font-size:26px;font-weight:400;color:#1C1A18;letter-spacing:-0.3px;line-height:1.25;margin-bottom:8px;animation:fadeUp 0.4s ease 0.16s both;}
        .ob-sub{font-size:14.5px;color:#8A8785;line-height:1.6;margin-bottom:28px;animation:fadeUp 0.4s ease 0.20s both;}

        .trust-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;padding:16px;background:#FAFAF8;border-radius:14px;border:1px solid rgba(0,0,0,0.06);animation:fadeUp 0.4s ease 0.24s both;}
        .trust-pill{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:100px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.10);font-size:13px;font-weight:500;color:#4A4845;white-space:nowrap;}
        .trust-pill:hover{background:#FFFFFF;border-color:rgba(0,0,0,0.12);}

        .feature-list{animation:fadeUp 0.4s ease 0.28s both;margin-bottom:28px;border-radius:14px;border:1px solid rgba(0,0,0,0.07);overflow:hidden;background:#FFFFFF;}
        .feature-row{display:flex;align-items:flex-start;gap:16px;padding:16px 18px;border-bottom:1px solid rgba(0,0,0,0.06);}.feature-row:last-child{border-bottom:none;}
        .feature-row:last-child{border-bottom:none;}
        .feature-icon-box{width:42px;height:42px;border-radius:11px;background:#FAF9F5;border:1px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;}
        .feature-row:hover .feature-icon-box{background:linear-gradient(135deg,rgba(91,168,216,0.08),rgba(91,168,216,0.03));border-color:rgba(91,168,216,0.12);transform:scale(1.04);}
        .feature-title{font-size:14.5px;font-weight:600;color:#1C1A18;margin-bottom:4px;line-height:1.3;letter-spacing:-0.1px;}
        .feature-desc{font-size:13px;color:#8A8785;line-height:1.58;}

        .field{margin-bottom:18px;animation:fadeUp 0.35s ease both;}
        .field:nth-child(1){animation-delay:0.12s;}.field:nth-child(2){animation-delay:0.16s;}.field:nth-child(3){animation-delay:0.20s;}.field:nth-child(4){animation-delay:0.24s;}.field:nth-child(5){animation-delay:0.28s;}
        .field-label{font-size:13px;font-weight:500;color:#4A4845;margin-bottom:6px;display:block;}
        .field-hint{font-size:12px;color:#C0BDB8;margin-top:4px;}
        .field-input{width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.10);background:#FAFAF8;font-family:'DM Sans',sans-serif;font-size:15px;color:#1C1A18;outline:none;transition:all 180ms ease;-webkit-appearance:none;}
        .field-input:focus{background:#FFFFFF;border-color:rgba(91,168,216,0.40);box-shadow:0 0 0 3px rgba(91,168,216,0.08);}
        .field-input::placeholder{color:#C0BDB8;font-weight:300;}
        textarea.field-input{resize:none;line-height:1.55;}

        .btn-primary{width:100%;padding:14px 16px;border-radius:13px;border:none;background:#1C1A18;color:#FAFAF8;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;transition:all 180ms ease;letter-spacing:-0.1px;}
        .btn-primary:hover:not(:disabled){background:#2E2C2A;transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.16);}
        .btn-primary:active{transform:translateY(0);}.btn-primary:disabled{opacity:0.50;cursor:not-allowed;transform:none;}
        .btn-back{padding:14px 22px;border-radius:13px;border:1px solid rgba(0,0,0,0.10);background:transparent;color:#6B6865;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:400;cursor:pointer;transition:all 160ms ease;white-space:nowrap;flex-shrink:0;}
        .btn-back:hover{background:#FAFAF8;border-color:rgba(0,0,0,0.18);color:#1C1A18;}
        .nav-row{display:flex;gap:10px;margin-top:8px;animation:fadeUp 0.4s ease 0.32s both;}
        .back-link{display:block;text-align:center;margin-top:16px;font-size:13.5px;color:#C0BDB8;text-decoration:none;transition:color 140ms ease;animation:fadeUp 0.4s ease 0.36s both;}
        .back-link:hover{color:#6B6865;}

        .info-box{padding:14px 16px;border-radius:12px;background:rgba(91,168,216,0.06);border:1px solid rgba(91,168,216,0.12);font-size:13px;color:#2A6090;line-height:1.55;margin-bottom:18px;display:flex;align-items:flex-start;gap:10px;}
        .info-box svg{flex-shrink:0;margin-top:1px;}

        .security-card{padding:20px;border-radius:16px;border:1px solid rgba(0,0,0,0.06);background:#FAFAF8;margin-bottom:14px;transition:all 180ms ease;animation:fadeUp 0.4s ease both;}
        .security-card:nth-child(1){animation-delay:0.12s;}.security-card:nth-child(2){animation-delay:0.18s;}
        .security-card:hover{border-color:rgba(0,0,0,0.10);background:#FFFFFF;}
        .security-header{display:flex;align-items:flex-start;gap:14px;}
        .security-title{font-size:15px;font-weight:500;color:#1C1A18;margin-bottom:4px;display:flex;align-items:center;gap:6px;}
        .security-desc{font-size:13px;color:#8A8785;line-height:1.55;}

        .toggle{width:48px;height:28px;border-radius:14px;border:none;cursor:pointer;position:relative;transition:background 220ms ease;flex-shrink:0;margin-top:2px;}
        .toggle::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#FFFFFF;box-shadow:0 1px 4px rgba(0,0,0,0.15),0 0 1px rgba(0,0,0,0.1);transition:transform 220ms cubic-bezier(0.16,1,0.3,1);}
        .toggle-off{background:rgba(0,0,0,0.12);}.toggle-on{background:#1C1A18;}.toggle-on::after{transform:translateX(20px);}
        .security-hint{margin-top:14px;padding:10px 14px;border-radius:10px;background:rgba(91,168,216,0.06);border:1px solid rgba(91,168,216,0.10);font-size:13px;color:#2A6090;animation:fadeUp 0.3s ease both;}

        .guarantees{padding:20px;border-radius:16px;background:linear-gradient(135deg,rgba(248,252,255,0.90),rgba(245,250,255,0.60));border:1px solid rgba(91,168,216,0.10);margin-bottom:18px;animation:fadeUp 0.4s ease 0.24s both;}
        .guarantees-title{font-size:10.5px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#5080A0;margin-bottom:16px;}
        .guarantee-item{display:flex;gap:12px;align-items:flex-start;padding:8px 0;}
        .guarantee-item + .guarantee-item{border-top:1px solid rgba(91,168,216,0.06);padding-top:10px;}
        .guarantee-icon{width:28px;height:28px;border-radius:7px;background:rgba(91,168,216,0.08);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
        .guarantee-label{font-size:13.5px;font-weight:500;color:#1C1A18;margin-bottom:1px;}
        .guarantee-desc{font-size:12.5px;color:#8A8785;line-height:1.50;}

        .error-box{padding:12px 16px;border-radius:11px;background:rgba(255,240,240,0.90);border:1px solid rgba(200,80,80,0.14);font-size:13.5px;color:#8B2020;line-height:1.5;margin-bottom:16px;animation:fadeUp 0.3s ease both;}

        .done-center{text-align:center;padding:12px 0 0;animation:fadeUp 0.45s ease both;}
        .done-check{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(26,92,50,0.08),rgba(26,92,50,0.03));display:flex;align-items:center;justify-content:center;margin:0 auto 22px;animation:checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both;}
        .done-heading{font-family:'Lora',Georgia,serif;font-size:26px;font-weight:400;color:#1A5C32;letter-spacing:-0.3px;margin-bottom:8px;}
        .done-sub{font-size:14.5px;color:#8A8785;line-height:1.58;margin-bottom:28px;}
        .done-stats{display:flex;gap:12px;margin-bottom:28px;}
        .done-stat{flex:1;padding:22px 16px;border-radius:16px;background:#FAFAF8;border:1px solid rgba(0,0,0,0.05);text-align:center;transition:all 180ms ease;}
        .done-stat:hover{background:#FFFFFF;border-color:rgba(0,0,0,0.08);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.05);}
        .done-stat-num{font-family:'Lora',Georgia,serif;font-size:34px;color:#1C1A18;margin-bottom:4px;}
        .done-stat-label{font-size:12px;color:#8A8785;font-weight:400;}
        .done-info{padding:16px 18px;border-radius:14px;background:rgba(91,168,216,0.06);border:1px solid rgba(91,168,216,0.10);text-align:left;margin-bottom:24px;font-size:14px;color:#2A6090;line-height:1.6;}
        .done-link{display:block;width:100%;padding:14px;border-radius:13px;background:#1C1A18;color:#F5F4F0;font-size:15px;font-weight:500;text-decoration:none;text-align:center;font-family:'DM Sans',sans-serif;transition:all 180ms ease;}
        .done-link:hover{background:#2E2C2A;transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.16);}
        .done-secondary{display:block;text-align:center;margin-top:14px;font-size:13.5px;color:#8A8785;text-decoration:none;transition:color 140ms ease;}
        .done-secondary:hover{color:#4A4845;}

        @media(max-width:560px){.ob-card{padding:32px 24px 28px;border-radius:20px;}.ob-heading{font-size:22px;}.feature-icon-box{width:38px;height:38px;border-radius:10px;font-size:18px;}}

        @keyframes cardEnter{from{opacity:0;transform:translateY(20px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes glowPulse{0%,100%{opacity:0.7;transform:translateX(-50%) scale(1);}50%{opacity:1;transform:translateX(-50%) scale(1.05);}}
        @keyframes checkPop{from{opacity:0;transform:scale(0.5);}to{opacity:1;transform:scale(1);}}
      `}</style>

      <div className="ob-root">
        <div className="ob-card">
          <div className="ob-logo">
            <img src="/memori-icon.png" alt="Seven" />
            <span className="ob-brand">Seven</span>
            {step > 0 && step < 5 && <span className="ob-step-label">Step {step} of 4</span>}
          </div>

          {step > 0 && step < 5 && (
            <div className="ob-progress"><div className="ob-progress-fill" style={{ width:`${progress}%` }}/></div>
          )}

          {step === 0 && (
            <>
              <div className="ob-label">Getting started</div>
              <h1 className="ob-heading">Your memory,<br/>built to last.</h1>
              <p className="ob-sub">Seven remembers what matters &mdash; your decisions, your life, your patterns &mdash; and keeps it safe. Set up takes about 2 minutes.</p>
              <div className="trust-bar">
                {[{i:"🔒",t:"Encrypted"},{i:"👁",t:"You own it"},{i:"🚫",t:"Never sold"},{i:"🛡",t:"Always correctable"}].map(({i,t})=>(
                  <div key={t} className="trust-pill">{i} {t}</div>
                ))}
              </div>
              <div className="feature-list">
                <div className="feature-row"><div className="feature-icon-box">🧠</div><div><div className="feature-title">Persistent memory</div><div className="feature-desc">Seven remembers facts about your life across every conversation.</div></div></div>
                <div className="feature-row"><div className="feature-icon-box">⚖️</div><div><div className="feature-title">Decision accountability</div><div className="feature-desc">Log decisions and Seven reminds you to review the outcomes.</div></div></div>
                <div className="feature-row"><div className="feature-icon-box">🛡</div><div><div className="feature-title">Full governance</div><div className="feature-desc">View, correct, dispute, or delete everything Seven knows. Always.</div></div></div>
              </div>
              <button className="btn-primary" onClick={next} style={{animation:"fadeUp 0.4s ease 0.34s both"}}>Get started →</button>
              <a href="/" className="back-link">← Back to Seven</a>
            </>
          )}

          {step === 1 && (
            <>
              <div className="ob-label">About you</div>
              <h1 className="ob-heading">Tell Seven who you are.</h1>
              <p className="ob-sub">This lets Seven greet you correctly and personalise its responses from day one.</p>
              <div className="field"><label className="field-label">Your name</label><input className="field-input" value={values.name??""} onChange={e=>set("name",e.target.value)} placeholder="Abraham" autoFocus/><div className="field-hint">How Seven will address you</div></div>
              <div className="field"><label className="field-label">City</label><input className="field-input" value={values.city??""} onChange={e=>set("city",e.target.value)} placeholder="London"/><div className="field-hint">Used for local context</div></div>
              <div className="field"><label className="field-label">Timezone</label><input className="field-input" value={values.timezone??""} onChange={e=>set("timezone",e.target.value)} placeholder="Europe/London"/><div className="field-hint">e.g. Europe/London, America/New_York</div></div>
              <div className="field"><label className="field-label">Company or project</label><input className="field-input" value={values.company??""} onChange={e=>set("company",e.target.value)} placeholder="Seven"/><div className="field-hint">Where you work or what you are building</div></div>
              <div className="field"><label className="field-label">Your role</label><input className="field-input" value={values.role??""} onChange={e=>set("role",e.target.value)} placeholder="CEO, Founder, Engineer..."/></div>
              <div className="nav-row"><button className="btn-back" onClick={back}>Back</button><button className="btn-primary" style={{flex:1}} onClick={next}>Continue →</button></div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="ob-label">Your world</div>
              <h1 className="ob-heading">The people and things that matter.</h1>
              <p className="ob-sub">Seven uses this to understand your context so you never have to explain it again.</p>
              <div className="field"><label className="field-label">One important person in your life</label><input className="field-input" value={values.relationshipLabel??""} onChange={e=>set("relationshipLabel",e.target.value)} placeholder="colleague, partner, friend, sister..." autoFocus/><div className="field-hint">Type of relationship</div></div>
              <div className="field"><label className="field-label">Their name</label><input className="field-input" value={values.relationshipName??""} onChange={e=>set("relationshipName",e.target.value)} placeholder="James"/></div>
              <div className="field"><label className="field-label">Pet type</label><input className="field-input" value={values.petType??""} onChange={e=>set("petType",e.target.value)} placeholder="dog, cat..."/><div className="field-hint">Optional</div></div>
              <div className="field"><label className="field-label">Pet name</label><input className="field-input" value={values.petName??""} onChange={e=>set("petName",e.target.value)} placeholder="Bruno"/><div className="field-hint">Optional</div></div>
              <div className="info-box"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5BA8D8" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>This information is stored privately and encrypted. Only you can see it.</div>
              <div className="nav-row"><button className="btn-back" onClick={back}>Back</button><button className="btn-primary" style={{flex:1}} onClick={next}>Continue →</button></div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="ob-label">Goals and preferences</div>
              <h1 className="ob-heading">What are you working toward?</h1>
              <p className="ob-sub">Seven uses this to give you more relevant advice and surface better patterns over time.</p>
              <div className="field"><label className="field-label">Current goal</label><textarea className="field-input" value={values.currentGoal??""} onChange={e=>set("currentGoal",e.target.value)} placeholder="I am building Seven and trying to get to 100 active users by Q3..." rows={4} autoFocus/><div className="field-hint">Seven will keep this in context during conversations</div></div>
              <div className="field"><label className="field-label">Important preference</label><textarea className="field-input" value={values.importantPreference??""} onChange={e=>set("importantPreference",e.target.value)} placeholder="I prefer direct, concise answers. I do not like vague advice..." rows={3}/><div className="field-hint">Something Seven should always remember about how you like to work</div></div>
              <div className="nav-row"><button className="btn-back" onClick={back}>Back</button><button className="btn-primary" style={{flex:1}} onClick={next}>Continue →</button></div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="ob-label">Security setup</div>
              <h1 className="ob-heading">Your memory, protected.</h1>
              <p className="ob-sub">Choose how Seven keeps you safe. You can change these any time in Settings.</p>
              <div className="security-card"><div className="security-header"><div style={{flex:1}}><div className="security-title">🎙 Voice recognition</div><div className="security-desc">Seven learns your voice so only you can access memories via voice. Recorded locally, never sent to a server.</div></div><button className={`toggle ${voiceEnabled?"toggle-on":"toggle-off"}`} onClick={()=>setVoiceEnabled(v=>!v)} aria-label="Toggle voice security"/></div>{voiceEnabled && <div className="security-hint">Voice recognition will be set up on your first voice interaction.</div>}</div>
              <div className="security-card"><div className="security-header"><div style={{flex:1}}><div className="security-title">🔔 Review reminders</div><div className="security-desc">Get notified when decisions are due for review. Keeps your memory accurate and accountable.</div></div><button className={`toggle ${notifEnabled?"toggle-on":"toggle-off"}`} onClick={()=>setNotifEnabled(v=>!v)} aria-label="Toggle reminders"/></div></div>
              <div className="guarantees">
                <div className="guarantees-title">Our security guarantees</div>
                {[{i:"🔒",l:"AES-256 encryption",d:"All your memories are encrypted at rest and in transit."},{i:"🗑",l:"Right to delete",d:"Delete any fact, decision, or your entire account at any time."},{i:"📤",l:"Data portability",d:"Export everything you have ever stored in one click."},{i:"🚫",l:"Zero advertising",d:"Your data never funds advertising. Not now, not ever."}].map(({i,l,d})=>(
                  <div key={l} className="guarantee-item"><div className="guarantee-icon">{i}</div><div><div className="guarantee-label">{l}</div><div className="guarantee-desc">{d}</div></div></div>
                ))}
              </div>
              {errorMsg && <div className="error-box">{errorMsg}</div>}
              <div className="nav-row"><button className="btn-back" onClick={back}>Back</button><button className="btn-primary" style={{flex:1}} onClick={()=>void finish()} disabled={busy}>{busy ? "Saving..." : "Complete setup →"}</button></div>
            </>
          )}

          {step === 5 && (
            <div className="done-center">
              <div className="done-check"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A5C32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              <h1 className="done-heading">You are all set</h1>
              <p className="done-sub">Seven now knows who you are and is ready to start building your cognitive memory.</p>
              {result && (<div className="done-stats"><div className="done-stat"><div className="done-stat-num">{result.raw}</div><div className="done-stat-label">facts stored</div></div><div className="done-stat"><div className="done-stat-num">{result.canonical}</div><div className="done-stat-label">canonical facts</div></div></div>)}
              <div className="done-info"><strong>What happens next:</strong> Start a conversation with Seven. Every interaction deepens your memory. Log a decision and Seven will remind you to review it.</div>
              <a href="/" className="done-link">Start talking to Seven →</a>
              <a href="/vault" className="done-secondary">View your memory vault</a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
