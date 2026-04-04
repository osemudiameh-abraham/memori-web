"use client";

import { useState } from "react";

type OnboardingResponse = { ok: true; stored_raw_fact_count: number; canonical_fact_count: number } | { ok: false; error: string };

const fields = [
  { key:"name",                label:"Your name",              placeholder:"Abraham",              type:"input",    hint:"How Memori will greet you" },
  { key:"city",                label:"City you live in",       placeholder:"London",               type:"input",    hint:"Used for local context and timezone" },
  { key:"timezone",            label:"Timezone",               placeholder:"Europe/London",        type:"input",    hint:"e.g. America/New_York, Asia/Tokyo" },
  { key:"company",             label:"Company or organisation",placeholder:"Memori",               type:"input",    hint:"Where you work or what you're building" },
  { key:"role",                label:"Your role",              placeholder:"CEO",                  type:"input",    hint:"What you do" },
  { key:"relationshipLabel",   label:"One key relationship",   placeholder:"friend, partner, colleague…", type:"input", hint:"Type of relationship" },
  { key:"relationshipName",    label:"Their name",             placeholder:"James",                type:"input",    hint:"The person's name" },
  { key:"petType",             label:"Pet type",               placeholder:"dog, cat…",            type:"input",    hint:"Optional" },
  { key:"petName",             label:"Pet's name",             placeholder:"Bruno",                type:"input",    hint:"Optional" },
  { key:"currentGoal",         label:"Current goal",           placeholder:"What are you working toward?", type:"textarea", hint:"Helps Memori give relevant advice" },
  { key:"importantPreference", label:"Important preference",   placeholder:"e.g. I prefer direct feedback", type:"textarea", hint:"Anything Memori should always remember" },
];

export default function OnboardingPage() {
  const [values, setValues] = useState<Record<string,string>>({});
  const [status, setStatus] = useState<"idle"|"busy"|"done"|"error">("idle");
  const [result, setResult] = useState<{raw:number;canonical:number}|null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function set(key: string, val: string) { setValues(v => ({ ...v, [key]: val })); }

  async function submit() {
    setStatus("busy"); setErrorMsg("");
    try {
      const res = await fetch("/api/onboarding", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ name:values.name??"", city:values.city??"", timezone:values.timezone??"", company:values.company??"", role:values.role??"", relationshipLabel:values.relationshipLabel??"", relationshipName:values.relationshipName??"", petType:values.petType??"", petName:values.petName??"", currentGoal:values.currentGoal??"", importantPreference:values.importantPreference??""}) });
      const data = (await res.json().catch(() => ({}))) as OnboardingResponse;
      if (!res.ok || data.ok === false) { setErrorMsg(data.ok===false?data.error:"Onboarding failed"); setStatus("error"); return; }
      setResult({ raw:data.stored_raw_fact_count, canonical:data.canonical_fact_count });
      setStatus("done");
    } catch (e:unknown) { setErrorMsg(e instanceof Error?e.message:"Onboarding failed"); setStatus("error"); }
  }

  const inp: React.CSSProperties = { width:"100%", padding:"11px 14px", borderRadius:11, border:"1.5px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.80)", fontFamily:"'DM Sans',sans-serif", fontSize:15, color:"#1C1A18", outline:"none", transition:"border-color 150ms ease" };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}html,body{height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#F5F4F0;color:#1C1A18;}input:focus,textarea:focus{border-color:rgba(0,0,0,0.28)!important;}input::placeholder,textarea::placeholder{color:#B0ADA8;}`}</style>
      <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),#F5F4F0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom:"1px solid rgba(0,0,0,0.07)", background:"rgba(245,244,240,0.80)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/" style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, textDecoration:"none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Home
            </a>
            <span style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:500, color:"#2A2825" }}>Onboarding</span>
          </div>
        </div>
        <div style={{ maxWidth:580, margin:"0 auto", padding:"32px 24px 80px" }}>
          <p style={{ fontSize:14.5, color:"#6B6865", lineHeight:1.60, marginBottom:32 }}>Seed Memori with your core facts so recall works from your very first conversation.</p>
          {status==="done" && result ? (
            <div style={{ textAlign:"center", padding:"48px 24px", background:"rgba(220,245,230,0.90)", border:"1px solid rgba(30,140,70,0.18)", borderRadius:20 }}>
              <div style={{ fontSize:36, marginBottom:16 }}>✓</div>
              <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:22, color:"#1A5C32", marginBottom:8 }}>You're all set</div>
              <div style={{ fontSize:14, color:"#2A7A4A", marginBottom:24 }}>{result.raw} facts stored · {result.canonical} canonical facts created</div>
              <a href="/" style={{ display:"inline-block", padding:"11px 24px", borderRadius:12, background:"#1C1A18", color:"#F5F4F0", fontSize:14, fontWeight:500, textDecoration:"none" }}>Start talking to Memori →</a>
            </div>
          ) : (
            <>
              <div style={{ display:"grid", gap:16 }}>
                {fields.map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize:13, fontWeight:500, color:"#4A4845", marginBottom:5 }}>{f.label}</div>
                    {f.type==="textarea" ? (
                      <textarea value={values[f.key]??""} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder} rows={3} style={{ ...inp, resize:"none", lineHeight:1.55 }}/>
                    ) : (
                      <input value={values[f.key]??""} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder} style={inp}/>
                    )}
                    {f.hint && <div style={{ fontSize:12, color:"#ABABAB", marginTop:4 }}>{f.hint}</div>}
                  </div>
                ))}
              </div>
              {errorMsg && <div style={{ marginTop:16, padding:"12px 16px", borderRadius:12, background:"rgba(255,240,240,0.95)", border:"1px solid rgba(185,60,60,0.18)", color:"#6A1A1A", fontSize:14 }}>{errorMsg}</div>}
              <button onClick={() => void submit()} disabled={status==="busy"} style={{ marginTop:24, width:"100%", padding:"13px", borderRadius:12, border:"none", background:"#1C1A18", color:"#F5F4F0", fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:500, cursor:"pointer", opacity:status==="busy"?0.6:1 }}>
                {status==="busy"?"Saving…":"Save to Memori"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
