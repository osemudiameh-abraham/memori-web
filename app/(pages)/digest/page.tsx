"use client";

import { useEffect, useState } from "react";

type DigestFact = { text: string; created_at: string };
type DigestDecision = { text_snapshot: string; created_at: string };
type DigestOutcome = { text_snapshot: string; outcome_label: string; created_at: string };
type DigestSummary = { facts: DigestFact[]; decisions: DigestDecision[]; outcomes: DigestOutcome[]; insight: string; counts: { facts: number; decisions: number; outcomes: number }; window: { since: string; until: string } };
type DigestResponse = { ok: true; summary: DigestSummary } | { ok: false; error: string };

type ImprovementSignal = { type: string; description: string; severity: "low" | "medium" | "high"; suggestion: string };
type ImprovementReport = { summary: string; signals: ImprovementSignal[]; recall_accuracy_estimate: number; decisions_failed: number; decisions_total: number };
type ImprovementResponse = { ok: true; report: ImprovementReport } | { ok: false; error: string };

function fmtDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short" });
}

const OUTCOME_COLORS: Record<string,{bg:string;text:string}> = {
  worked:  { bg:"rgba(20,140,60,0.10)",  text:"#1A5C32" },
  partial: { bg:"rgba(180,140,0,0.10)",  text:"#6A4A00" },
  failed:  { bg:"rgba(160,30,30,0.10)",  text:"#6A1A1A" },
};

export default function DigestPage() {
  const [data, setData] = useState<DigestSummary|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [improvement, setImprovement] = useState<ImprovementReport|null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const [digestRes, improveRes] = await Promise.all([
        fetch("/api/digest/weekly", { credentials:"include" }),
        fetch("/api/self-improve", { method:"POST", credentials:"include" }),
      ]);
      const payload = (await digestRes.json().catch(()=>({}))) as DigestResponse;
      const improvePayload = (await improveRes.json().catch(()=>({}))) as ImprovementResponse;
      if (!digestRes.ok || payload.ok===false) { setError(payload.ok===false?payload.error:"Unable to load digest."); return; }
      setData(payload.summary);
      if (improvePayload.ok) setImprovement(improvePayload.report);
    } catch { setError("Unable to load digest."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const card: React.CSSProperties = { background:"rgba(255,255,255,0.90)", border:"1px solid rgba(0,0,0,0.08)", borderRadius:14, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}html,body{height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#FAF9F5;color:#1C1A18;}`}</style>
      <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),#F5F4F0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom:"1px solid rgba(0,0,0,0.07)", background:"rgba(245,244,240,0.80)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/" style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, textDecoration:"none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Home
            </a>
            <span style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:500, color:"#2A2825" }}>Weekly Digest</span>
          </div>
          <button onClick={() => void load()} disabled={loading} style={{ padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>{loading?"Refreshing…":"Refresh"}</button>
        </div>
        <div style={{ maxWidth:680, margin:"0 auto", padding:"32px 24px 60px" }}>
          {loading ? <div style={{ textAlign:"center", padding:60, color:"#8A8785", fontSize:14 }}>Loading your digest…</div>
          : error ? <div style={{ padding:"12px 16px", borderRadius:12, background:"rgba(255,240,240,0.95)", border:"1px solid rgba(185,60,60,0.18)", color:"#6A1A1A", fontSize:14 }}>{error}</div>
          : !data ? <div style={{ textAlign:"center", padding:60, color:"#8A8785" }}>No data available.</div>
          : (
            <div style={{ display:"grid", gap:16 }}>
              {/* Insight */}
              <div style={{ ...card, background:"rgba(248,248,255,0.95)", borderColor:"rgba(100,100,200,0.14)" }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.09em", textTransform:"uppercase", color:"#5858A0", marginBottom:10 }}>Weekly insight</div>
                <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:18, lineHeight:1.58, color:"#1C1A18" }}>{data.insight}</div>
                <div style={{ marginTop:12, fontSize:12, color:"#ABABAB" }}>{fmtDate(data.window.since)} → {fmtDate(data.window.until)}</div>
              </div>

              {/* Stats */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {[
                  { label:"Facts learned",    value:data.counts.facts,     icon:"🧠" },
                  { label:"Decisions made",   value:data.counts.decisions, icon:"⚖️" },
                  { label:"Outcomes logged",  value:data.counts.outcomes,  icon:"📌" },
                ].map(s => (
                  <div key={s.label} style={card}>
                    <div style={{ fontSize:18, marginBottom:8 }}>{s.icon}</div>
                    <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:28, fontWeight:400, color:"#1C1A18", lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:12, color:"#8A8785", marginTop:6 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Self-improvement report */}
              {improvement && (
                <div style={{ background:"rgba(255,255,255,0.90)", border:"1px solid rgba(0,0,0,0.08)", borderRadius:14, padding:"18px 20px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                    <span style={{ fontSize:16 }}>🔍</span>
                    <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:16, fontWeight:500, color:"#2A2825" }}>Weekly self-assessment</div>
                    <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.07em", padding:"2px 8px", borderRadius:100, background:"rgba(0,0,0,0.05)", color:"#8A8785" }}>AUTO</span>
                  </div>
                  <p style={{ fontSize:14.5, color:"#3C3A38", lineHeight:1.60, marginBottom:improvement.signals.length > 0 ? 14 : 0 }}>{improvement.summary}</p>
                  {improvement.signals.length > 0 && (
                    <div style={{ display:"grid", gap:8 }}>
                      {improvement.signals.map((s, i) => {
                        const sevColor = s.severity === "high"
                          ? { bg:"rgba(255,240,240,0.90)", border:"rgba(185,60,60,0.18)", text:"#6A1A1A", dot:"#C04040" }
                          : s.severity === "medium"
                          ? { bg:"rgba(255,248,225,0.90)", border:"rgba(185,150,30,0.20)", text:"#5A3A00", dot:"#C09020" }
                          : { bg:"rgba(235,245,255,0.90)", border:"rgba(80,130,200,0.18)", text:"#1A3A70", dot:"#4080C0" };
                        return (
                          <div key={i} style={{ padding:"12px 14px", borderRadius:11, background:sevColor.bg, border:`1px solid ${sevColor.border}` }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                              <span style={{ width:6, height:6, borderRadius:"50%", background:sevColor.dot, display:"inline-block", flexShrink:0 }}/>
                              <span style={{ fontSize:13, fontWeight:500, color:sevColor.text }}>{s.description}</span>
                            </div>
                            <div style={{ fontSize:12.5, color:sevColor.text, opacity:0.80, lineHeight:1.50, paddingLeft:12 }}>{s.suggestion}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display:"flex", gap:12, marginTop:14, paddingTop:14, borderTop:"1px solid rgba(0,0,0,0.06)" }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:22, color:"#1C1A18" }}>{improvement.recall_accuracy_estimate}%</div>
                      <div style={{ fontSize:11, color:"#ABABAB", marginTop:2 }}>recall score</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:22, color:"#1C1A18" }}>{improvement.decisions_failed}/{improvement.decisions_total}</div>
                      <div style={{ fontSize:11, color:"#ABABAB", marginTop:2 }}>decisions failed</div>
                    </div>
                    <div style={{ flex:1 }}/>
                    <a href="/reviews" style={{ display:"inline-flex", alignItems:"center", alignSelf:"center", gap:5, padding:"7px 14px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.80)", color:"#3C3A38", fontSize:13.5, textDecoration:"none" }}>Review decisions →</a>
                  </div>
                </div>
              )}

              {/* Facts */}
              {data.facts.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#ABABAB", marginBottom:10 }}>What Memori learned</div>
                  <div style={{ display:"grid", gap:8 }}>
                    {data.facts.map((f,i) => (
                      <div key={i} style={card}>
                        <div style={{ fontSize:15, lineHeight:1.58, color:"#1C1A18" }}>{f.text}</div>
                        <div style={{ fontSize:12, color:"#ABABAB", marginTop:6 }}>{fmtDate(f.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {data.decisions.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#ABABAB", marginBottom:10 }}>Decisions you made</div>
                  <div style={{ display:"grid", gap:8 }}>
                    {data.decisions.map((d,i) => (
                      <div key={i} style={card}>
                        <div style={{ fontSize:15, lineHeight:1.58, color:"#1C1A18" }}>{d.text_snapshot}</div>
                        <div style={{ fontSize:12, color:"#ABABAB", marginTop:6 }}>{fmtDate(d.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outcomes */}
              {data.outcomes.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#ABABAB", marginBottom:10 }}>Outcomes logged</div>
                  <div style={{ display:"grid", gap:8 }}>
                    {data.outcomes.map((o,i) => {
                      const oc = OUTCOME_COLORS[o.outcome_label] ?? { bg:"rgba(0,0,0,0.05)", text:"#3C3A38" };
                      return (
                        <div key={i} style={card}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                            <span style={{ padding:"2px 9px", borderRadius:100, fontSize:11, fontWeight:600, letterSpacing:"0.07em", background:oc.bg, color:oc.text }}>{o.outcome_label}</span>
                            <span style={{ fontSize:12, color:"#ABABAB" }}>{fmtDate(o.created_at)}</span>
                          </div>
                          <div style={{ fontSize:15, lineHeight:1.58, color:"#1C1A18" }}>{o.text_snapshot}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!data.facts.length && !data.decisions.length && !data.outcomes.length && (
                <div style={{ textAlign:"center", padding:"48px 24px", color:"#8A8785", fontSize:15 }}>No activity this week yet. Start a conversation.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
