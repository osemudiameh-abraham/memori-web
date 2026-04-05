"use client";

import { useState } from "react";

type OnboardingResponse = { ok: true; stored_raw_fact_count: number; canonical_fact_count: number } | { ok: false; error: string };

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { id: 0, label: "Welcome" },
  { id: 1, label: "About you" },
  { id: 2, label: "Your world" },
  { id: 3, label: "Goals" },
  { id: 4, label: "Security" },
  { id: 5, label: "Done" },
];

const inp: React.CSSProperties = {
  width:"100%", padding:"12px 14px", borderRadius:11,
  border:"1.5px solid rgba(0,0,0,0.12)",
  background:"rgba(255,255,255,0.85)",
  fontFamily:"'DM Sans',sans-serif", fontSize:15, color:"#1C1A18",
  outline:"none", transition:"border-color 150ms ease",
};

const fieldWrap: React.CSSProperties = { marginBottom: 16 };
const fieldLabel: React.CSSProperties = { fontSize:13, fontWeight:500, color:"#4A4845", marginBottom:6, display:"block" };
const fieldHint: React.CSSProperties = { fontSize:12, color:"#ABABAB", marginTop:4 };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={fieldWrap}>
      <label style={fieldLabel}>{label}</label>
      {children}
      {hint && <div style={fieldHint}>{hint}</div>}
    </div>
  );
}

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
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{min-height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#FAF9F5;color:#1C1A18;}
        input:focus,textarea:focus{border-color:rgba(0,0,0,0.3)!important;box-shadow:0 0 0 3px rgba(0,0,0,0.05)!important;outline:none;}
        input::placeholder,textarea::placeholder{color:#C0BDB8;}
        textarea{resize:none;}

        /* ── Root ── */
        .root{
          min-height:100vh;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          padding:40px 20px 60px;
          background:#FAF9F5;
        }

        /* ── Card ── */
        .card{
          width:100%;
          max-width:500px;
          background:#FFFFFF;
          border-radius:24px;
          border:1px solid rgba(0,0,0,0.07);
          box-shadow:0 4px 32px rgba(0,0,0,0.06),0 1px 4px rgba(0,0,0,0.04);
          padding:36px 36px 32px;
          animation:cardIn 0.45s cubic-bezier(0.16,1,0.3,1) both;
        }
        @media(max-width:560px){
          .card{padding:28px 22px 24px;border-radius:20px;}
        }

        /* ── Logo row ── */
        .logo-row{
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:32px;
        }
        .brand{
          font-family:'Lora',Georgia,serif;
          font-size:18px;
          font-weight:500;
          color:#1C1A18;
          letter-spacing:-0.2px;
        }

        /* ── Progress bar ── */
        .progress-track{
          width:100%;height:3px;
          background:rgba(0,0,0,0.07);
          border-radius:2px;
          margin-bottom:32px;
          overflow:hidden;
        }
        .progress-fill{
          height:100%;
          background:linear-gradient(90deg,#1C1A18,#4A4845);
          border-radius:2px;
          transition:width 450ms cubic-bezier(0.16,1,0.3,1);
        }

        /* ── Step label ── */
        .step-label{
          font-size:11px;
          font-weight:600;
          letter-spacing:0.8px;
          text-transform:uppercase;
          color:#C0BDB8;
          margin-bottom:8px;
        }

        /* ── Heading ── */
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
          line-height:1.6;
          margin-bottom:24px;
        }

        /* ── Inputs ── */
        input[type="text"],
        input[type="email"],
        textarea,
        select{
          width:100%;
          padding:11px 14px;
          border-radius:10px;
          border:1px solid rgba(0,0,0,0.12);
          background:#FAFAF8;
          font-family:'DM Sans',sans-serif;
          font-size:14.5px;
          color:#1C1A18;
          transition:border-color 150ms ease,box-shadow 150ms ease,background 150ms ease;
          -webkit-appearance:none;
        }
        input[type="text"]:focus,
        input[type="email"]:focus,
        textarea:focus,
        select:focus{
          background:#FFFFFF;
        }
        .field-label{
          font-size:13px;
          font-weight:500;
          color:#4A4845;
          margin-bottom:5px;
          display:block;
        }
        .field-wrap{
          margin-bottom:14px;
        }

        /* ── Primary button ── */
        .primary-btn{
          width:100%;
          padding:13px 16px;
          border-radius:12px;
          border:none;
          background:#1C1A18;
          color:#FAFAF8;
          font-family:'DM Sans',sans-serif;
          font-size:15px;
          font-weight:500;
          cursor:pointer;
          transition:all 150ms ease;
          margin-top:8px;
          letter-spacing:-0.1px;
        }
        .primary-btn:hover:not(:disabled){
          background:#2E2C2A;
          transform:translateY(-1px);
          box-shadow:0 4px 12px rgba(0,0,0,0.18);
        }
        .primary-btn:active{transform:translateY(0);}
        .primary-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;}

        /* ── Skip button ── */
        .skip-btn{
          width:100%;
          padding:11px 16px;
          border-radius:12px;
          border:1px solid rgba(0,0,0,0.09);
          background:transparent;
          color:#8A8785;
          font-family:'DM Sans',sans-serif;
          font-size:14px;
          cursor:pointer;
          transition:all 130ms ease;
          margin-top:8px;
        }
        .skip-btn:hover{
          background:#FFFFFF;
          border-color:rgba(0,0,0,0.16);
          color:#4A4845;
        }

        /* ── Chip multi-select ── */
        .chips-grid{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-bottom:20px;
        }
        .chip{
          padding:8px 14px;
          border-radius:100px;
          border:1px solid rgba(0,0,0,0.12);
          background:#FAFAF8;
          font-family:'DM Sans',sans-serif;
          font-size:13.5px;
          color:#4A4845;
          cursor:pointer;
          transition:all 140ms ease;
          user-select:none;
        }
        .chip:hover{
          border-color:rgba(0,0,0,0.22);
          background:#FFFFFF;
        }
        .chip.selected{
          background:#1C1A18;
          color:#FAFAF8;
          border-color:#1C1A18;
        }

        /* ── Welcome step ── */
        .welcome-icon{
          font-size:44px;
          margin-bottom:16px;
          display:block;
        }

        /* ── Step transition ── */
        .step-content{
          animation:stepIn 0.3s cubic-bezier(0.16,1,0.3,1) both;
        }

        /* ── Done/complete ── */
        .done-icon{font-size:40px;margin-bottom:14px;display:block;}

        /* ── Animations ── */
        @keyframes cardIn{
          from{opacity:0;transform:translateY(16px) scale(0.98);}
          to{opacity:1;transform:translateY(0) scale(1);}
        }
        @keyframes stepIn{
          from{opacity:0;transform:translateX(10px);}
          to{opacity:1;transform:translateX(0);}
        }
      `}</style>

      <div className="root">
        <div className="card">
          {/* Logo */}
          <div className="logo-row">
            <img src="/memori-icon.png" alt="Memori" style={{ width:32, height:32, objectFit:"contain" }}/>
            <span className="brand">Memori</span>
            {step < 5 && step > 0 && (
              <span style={{ marginLeft:"auto", fontSize:12, color:"#ABABAB" }}>Step {step} of 4</span>
            )}
          </div>

          {/* Progress */}
          {step > 0 && step < 5 && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width:`${progress}%` }}/>
            </div>
          )}

          {/* ── STEP 0: WELCOME ── */}
          {step === 0 && (
            <>
              <div className="step-label">Getting started</div>
              <h1 className="heading">Your memory,<br/>built to last.</h1>
              <p className="sub">Memori remembers what matters — your decisions, your life, your patterns — and keeps it safe. Set up takes about 2 minutes.</p>

              <div className="trust-bar">
                {["🔒 Encrypted","👁 You own it","🚫 Never sold","🛡 Always correctable"].map(t => (
                  <div key={t} className="trust-pill">{t}</div>
                ))}
              </div>

              <div className="welcome-feature">
                <div className="feature-icon">🧠</div>
                <div>
                  <div className="feature-label">Persistent memory</div>
                  <div className="feature-desc">Memori remembers facts about your life across every conversation.</div>
                </div>
              </div>
              <div className="welcome-feature">
                <div className="feature-icon">⚖️</div>
                <div>
                  <div className="feature-label">Decision accountability</div>
                  <div className="feature-desc">Log decisions and Memori reminds you to review the outcomes.</div>
                </div>
              </div>
              <div className="welcome-feature">
                <div className="feature-icon">🛡</div>
                <div>
                  <div className="feature-label">Full governance</div>
                  <div className="feature-desc">View, correct, dispute, or delete everything Memori knows. Always.</div>
                </div>
              </div>

              <button className="primary-btn" onClick={next}>Get started →</button>
              <a href="/" style={{ display:"block", textAlign:"center", marginTop:14, fontSize:13.5, color:"#ABABAB", textDecoration:"none" }}>← Back to Memori</a>
            </>
          )}

          {/* ── STEP 1: ABOUT YOU ── */}
          {step === 1 && (
            <>
              <div className="step-label">About you</div>
              <h1 className="heading">Tell Memori who you are.</h1>
              <p className="sub">This lets Memori greet you correctly and personalise its responses from day one.</p>

              <Field label="Your name" hint="How Memori will address you">
                <input value={values.name??""} onChange={e=>set("name",e.target.value)} placeholder="Abraham" style={inp} autoFocus/>
              </Field>
              <Field label="City" hint="Used for local context">
                <input value={values.city??""} onChange={e=>set("city",e.target.value)} placeholder="London" style={inp}/>
              </Field>
              <Field label="Timezone" hint="e.g. Europe/London, America/New_York">
                <input value={values.timezone??""} onChange={e=>set("timezone",e.target.value)} placeholder="Europe/London" style={inp}/>
              </Field>
              <Field label="Company or project" hint="Where you work or what you're building">
                <input value={values.company??""} onChange={e=>set("company",e.target.value)} placeholder="Memori" style={inp}/>
              </Field>
              <Field label="Your role">
                <input value={values.role??""} onChange={e=>set("role",e.target.value)} placeholder="CEO, Founder, Engineer…" style={inp}/>
              </Field>

              <div className="nav-row">
                <button className="back-btn" onClick={back}>Back</button>
                <button className="primary-btn" style={{ flex:1, marginTop:0 }} onClick={next}>Continue →</button>
              </div>
            </>
          )}

          {/* ── STEP 2: YOUR WORLD ── */}
          {step === 2 && (
            <>
              <div className="step-label">Your world</div>
              <h1 className="heading">The people and things that matter.</h1>
              <p className="sub">Memori uses this to understand your context — who James is, who Bruno is — so you never have to explain it again.</p>

              <Field label="One important person in your life" hint="Type of relationship">
                <input value={values.relationshipLabel??""} onChange={e=>set("relationshipLabel",e.target.value)} placeholder="colleague, partner, friend, sister…" style={inp} autoFocus/>
              </Field>
              <Field label="Their name">
                <input value={values.relationshipName??""} onChange={e=>set("relationshipName",e.target.value)} placeholder="James" style={inp}/>
              </Field>
              <Field label="Pet type" hint="Optional">
                <input value={values.petType??""} onChange={e=>set("petType",e.target.value)} placeholder="dog, cat…" style={inp}/>
              </Field>
              <Field label="Pet name" hint="Optional">
                <input value={values.petName??""} onChange={e=>set("petName",e.target.value)} placeholder="Bruno" style={inp}/>
              </Field>

              <div style={{ padding:"12px 14px", borderRadius:11, background:"rgba(228,244,255,0.80)", border:"1px solid rgba(80,145,200,0.15)", fontSize:13, color:"#265580", lineHeight:1.55, marginBottom:16 }}>
                🔒 This information is stored privately and encrypted. Only you can see it.
              </div>

              <div className="nav-row">
                <button className="back-btn" onClick={back}>Back</button>
                <button className="primary-btn" style={{ flex:1, marginTop:0 }} onClick={next}>Continue →</button>
              </div>
            </>
          )}

          {/* ── STEP 3: GOALS ── */}
          {step === 3 && (
            <>
              <div className="step-label">Goals & preferences</div>
              <h1 className="heading">What are you working toward?</h1>
              <p className="sub">Memori uses this to give you more relevant advice and surface better patterns over time.</p>

              <Field label="Current goal" hint="Memori will keep this in context during conversations">
                <textarea value={values.currentGoal??""} onChange={e=>set("currentGoal",e.target.value)} placeholder="I'm building Memori and trying to get to 100 active users by Q3…" rows={4} style={{ ...inp, lineHeight:1.55 }} autoFocus/>
              </Field>
              <Field label="Important preference" hint="Something Memori should always remember about how you like to work">
                <textarea value={values.importantPreference??""} onChange={e=>set("importantPreference",e.target.value)} placeholder="I prefer direct, concise answers. I don't like vague advice…" rows={3} style={{ ...inp, lineHeight:1.55 }}/>
              </Field>

              <div className="nav-row">
                <button className="back-btn" onClick={back}>Back</button>
                <button className="primary-btn" style={{ flex:1, marginTop:0 }} onClick={next}>Continue →</button>
              </div>
            </>
          )}

          {/* ── STEP 4: SECURITY ── */}
          {step === 4 && (
            <>
              <div className="step-label">Security setup</div>
              <h1 className="heading">Your memory, protected.</h1>
              <p className="sub">Choose how Memori keeps you safe. You can change these any time in Settings.</p>

              {/* Voice security */}
              <div className="security-card">
                <div className="security-row">
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:500, color:"#1C1A18", marginBottom:4 }}>🎙 Voice recognition</div>
                    <div style={{ fontSize:13, color:"#8A8785", lineHeight:1.55 }}>Memori learns your voice so only you can access your memories via voice commands. Recorded locally — never sent to a server.</div>
                  </div>
                  <button
                    className={`toggle ${voiceEnabled?"toggle-on":"toggle-off"}`}
                    onClick={() => setVoiceEnabled(v=>!v)}
                    aria-label="Toggle voice security"
                  />
                </div>
                {voiceEnabled && (
                  <div style={{ marginTop:12, padding:"10px 12px", borderRadius:9, background:"rgba(228,244,255,0.80)", border:"1px solid rgba(80,145,200,0.15)", fontSize:13, color:"#265580" }}>
                    ✓ Voice recognition will be set up on your first voice interaction.
                  </div>
                )}
              </div>

              {/* Review reminders */}
              <div className="security-card">
                <div className="security-row">
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:500, color:"#1C1A18", marginBottom:4 }}>🔔 Review reminders</div>
                    <div style={{ fontSize:13, color:"#8A8785", lineHeight:1.55 }}>Get notified when decisions are due for review. Keeps your memory accurate and accountable.</div>
                  </div>
                  <button
                    className={`toggle ${notifEnabled?"toggle-on":"toggle-off"}`}
                    onClick={() => setNotifEnabled(v=>!v)}
                    aria-label="Toggle reminders"
                  />
                </div>
              </div>

              {/* Guarantees */}
              <div style={{ padding:"16px 18px", borderRadius:14, background:"rgba(248,252,255,0.90)", border:"1px solid rgba(80,145,200,0.14)", marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.09em", textTransform:"uppercase" as const, color:"#5080A0", marginBottom:12 }}>Our security guarantees</div>
                {[
                  ["🔒","AES-256 encryption","All your memories are encrypted at rest and in transit."],
                  ["🗑","Right to delete","Delete any fact, decision, or your entire account at any time."],
                  ["📤","Data portability","Export everything you've ever stored in one click."],
                  ["🚫","Zero advertising","Your data never funds advertising. Not now, not ever."],
                ].map(([icon,label,desc]) => (
                  <div key={label as string} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:12 }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:500, color:"#1C1A18", marginBottom:1 }}>{label}</div>
                      <div style={{ fontSize:12.5, color:"#8A8785", lineHeight:1.50 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {errorMsg && <div className="error-box">{errorMsg}</div>}

              <div className="nav-row">
                <button className="back-btn" onClick={back}>Back</button>
                <button className="primary-btn" style={{ flex:1, marginTop:0 }} onClick={() => void finish()} disabled={busy}>
                  {busy ? "Saving…" : "Complete setup →"}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 5: DONE ── */}
          {step === 5 && (
            <>
              <div style={{ textAlign:"center", paddingTop:12 }}>
                <div style={{ fontSize:52, marginBottom:20 }}>✓</div>
                <h1 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:26, fontWeight:400, color:"#1A5C32", letterSpacing:"-0.3px", marginBottom:8 }}>You're all set</h1>
                <p style={{ fontSize:14.5, color:"#8A8785", lineHeight:1.58, marginBottom:28 }}>Memori now knows who you are and is ready to start building your cognitive memory.</p>

                {result && (
                  <div style={{ display:"flex", gap:10, marginBottom:28 }}>
                    <div className="done-stat">
                      <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:32, color:"#1C1A18", marginBottom:4 }}>{result.raw}</div>
                      <div style={{ fontSize:12, color:"#8A8785" }}>facts stored</div>
                    </div>
                    <div className="done-stat">
                      <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:32, color:"#1C1A18", marginBottom:4 }}>{result.canonical}</div>
                      <div style={{ fontSize:12, color:"#8A8785" }}>canonical facts</div>
                    </div>
                  </div>
                )}

                <div style={{ padding:"14px 16px", borderRadius:13, background:"rgba(228,244,255,0.90)", border:"1px solid rgba(80,145,200,0.14)", textAlign:"left", marginBottom:24, fontSize:13.5, color:"#265580", lineHeight:1.60 }}>
                  <strong>What happens next:</strong> Start a conversation with Memori. Every interaction deepens your memory. Log a decision and Memori will remind you to review it.
                </div>

                <a href="/" style={{ display:"block", width:"100%", padding:"13px", borderRadius:11, background:"#1C1A18", color:"#F5F4F0", fontSize:15, fontWeight:500, textDecoration:"none", textAlign:"center", transition:"all 140ms ease" }}>
                  Start talking to Memori →
                </a>

                <a href="/vault" style={{ display:"block", textAlign:"center", marginTop:12, fontSize:13.5, color:"#8A8785", textDecoration:"none" }}>
                  View your memory vault
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
