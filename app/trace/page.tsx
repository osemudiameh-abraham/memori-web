"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Trace = {
  id: string;
  created_at: string;
  query_text: string;
  assistant_text: string;
  picked_memory_ids: string[];
  strategy_history: unknown[];
};
type TraceResponse = { ok: true; trace: Trace } | { ok: false; error: string };

function fmt(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

const navLink: React.CSSProperties = { display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, textDecoration:"none", transition:"all 130ms ease", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" };
const card: React.CSSProperties = { background:"rgba(255,255,255,0.90)", border:"1px solid rgba(0,0,0,0.08)", borderRadius:14, padding:"18px 20px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" };
const sectionLabel: React.CSSProperties = { fontSize:11, fontWeight:600, letterSpacing:"0.09em", textTransform:"uppercase" as const, color:"#ABABAB", marginBottom:12 };

function StrategyItem({ item, index }: { item: unknown; index: number }) {
  const [open, setOpen] = useState(false);
  const obj = item as Record<string, unknown>;
  const type = typeof obj?.type === "string" ? obj.type : `step_${index + 1}`;
  const score = typeof obj?.score === "number" ? obj.score : null;

  return (
    <div style={{ borderRadius:10, border:"1px solid rgba(0,0,0,0.08)", overflow:"hidden" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"rgba(248,248,252,0.80)", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", gap:12 }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase" as const, color:"#5858A0" }}>{type}</span>
          {score !== null && (
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:100, background:"rgba(80,80,180,0.10)", color:"#3A3890", fontWeight:500 }}>
              score {Math.round(score * 100) / 100}
            </span>
          )}
        </div>
        <span style={{ fontSize:13, color:"#ABABAB" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <pre style={{ margin:0, padding:"12px 14px", fontSize:11.5, lineHeight:1.6, color:"#3C3A38", whiteSpace:"pre-wrap", wordBreak:"break-all", background:"rgba(0,0,0,0.015)", fontFamily:"'SF Mono',Monaco,monospace", overflowX:"auto" }}>
          {JSON.stringify(item, null, 2)}
        </pre>
      )}
    </div>
  );
}

function TracePageInner() {
  const searchParams = useSearchParams();
  const traceId = (searchParams.get("id") ?? "").trim();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TraceResponse | null>(null);

  async function load() {
    if (!traceId) {
      setData({ ok:false, error:"Missing trace id. Navigate here from a chat response." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/trace/${encodeURIComponent(traceId)}`, { method:"GET", credentials:"include" });
      const json = (await res.json().catch(() => ({}))) as TraceResponse;
      if (!res.ok) { setData({ ok:false, error:(json as {error?:string}).error ?? `Request failed (HTTP ${res.status})` }); return; }
      setData(json);
    } catch (e:unknown) { setData({ ok:false, error:e instanceof Error ? e.message : "Request failed" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [traceId]);

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}html,body{height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#FAF9F5;color:#1C1A18;}`}</style>
      <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),#F5F4F0" }}>

        {/* Topbar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom:"1px solid rgba(0,0,0,0.07)", background:"rgba(245,244,240,0.80)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10, gap:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/" style={navLink}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Home
            </a>
            <span style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:500, color:"#2A2825" }}>Trace audit</span>
            {traceId && (
              <span style={{ fontSize:11, fontFamily:"monospace", color:"#ABABAB", background:"rgba(0,0,0,0.05)", padding:"2px 8px", borderRadius:6 }}>…{traceId.slice(-8)}</span>
            )}
          </div>
          <button onClick={() => void load()} disabled={loading} style={navLink}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div style={{ maxWidth:760, margin:"0 auto", padding:"32px 24px 60px" }}>

          {/* No trace id */}
          {!traceId && (
            <div style={{ ...card, textAlign:"center", padding:"48px 24px" }}>
              <div style={{ fontSize:32, marginBottom:16 }}>🔍</div>
              <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:20, color:"#2A2825", marginBottom:8 }}>No trace selected</div>
              <div style={{ fontSize:14.5, color:"#8A8785", lineHeight:1.60 }}>
                Traces are opened from a chat response.<br/>Go back to the home page and start a conversation.
              </div>
              <a href="/" style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:20, padding:"10px 20px", borderRadius:11, background:"#1C1A18", color:"#FAF9F5", fontSize:14, fontWeight:500, textDecoration:"none" }}>
                Back to Seven
              </a>
            </div>
          )}

          {/* Error */}
          {data?.ok === false && traceId && (
            <div style={{ padding:"12px 16px", borderRadius:12, background:"rgba(255,240,240,0.95)", border:"1px solid rgba(185,60,60,0.18)", color:"#6A1A1A", fontSize:14 }}>
              {data.error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign:"center", padding:60, color:"#8A8785", fontSize:14 }}>Loading trace…</div>
          )}

          {/* Trace data */}
          {data?.ok === true && !loading && (
            <div style={{ display:"grid", gap:14 }}>

              {/* Meta */}
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                {[
                  { label:"Captured", value:fmt(data.trace.created_at) },
                  { label:"Sevenes used", value:String(data.trace.picked_memory_ids.length) },
                  { label:"Strategy steps", value:String((data.trace.strategy_history ?? []).length) },
                ].map(m => (
                  <div key={m.label} style={{ ...card, flex:"1", minWidth:140, padding:"12px 16px" }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.09em", textTransform:"uppercase", color:"#ABABAB", marginBottom:4 }}>{m.label}</div>
                    <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:22, fontWeight:400, color:"#1C1A18" }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Conversation */}
              <div style={card}>
                <div style={sectionLabel}>Conversation</div>
                <div style={{ display:"grid", gap:12 }}>
                  <div>
                    <div style={{ fontSize:11.5, fontWeight:600, color:"#8A8785", marginBottom:6, letterSpacing:"0.05em", textTransform:"uppercase" }}>You asked</div>
                    <div style={{ fontSize:15, lineHeight:1.65, color:"#1C1A18", background:"rgba(0,0,0,0.025)", padding:"12px 14px", borderRadius:10, whiteSpace:"pre-wrap" }}>{data.trace.query_text}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11.5, fontWeight:600, color:"#8A8785", marginBottom:6, letterSpacing:"0.05em", textTransform:"uppercase" }}>Seven responded</div>
                    <div style={{ fontSize:15, lineHeight:1.65, color:"#1C1A18", background:"rgba(0,0,0,0.025)", padding:"12px 14px", borderRadius:10, whiteSpace:"pre-wrap" }}>{data.trace.assistant_text}</div>
                  </div>
                </div>
              </div>

              {/* Sevenes used */}
              <div style={card}>
                <div style={sectionLabel}>Memory IDs used ({data.trace.picked_memory_ids.length})</div>
                {data.trace.picked_memory_ids.length === 0 ? (
                  <div style={{ fontSize:14, color:"#8A8785" }}>No memories were retrieved for this response.</div>
                ) : (
                  <div style={{ display:"grid", gap:8 }}>
                    {data.trace.picked_memory_ids.map((id, i) => (
                      <div key={id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 13px", borderRadius:9, background:"rgba(0,0,0,0.03)", border:"1px solid rgba(0,0,0,0.06)" }}>
                        <span style={{ fontSize:11, color:"#ABABAB", flexShrink:0 }}>#{i+1}</span>
                        <span style={{ fontSize:12.5, fontFamily:"'SF Mono',Monaco,monospace", color:"#3C3A38", wordBreak:"break-all" }}>{id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Strategy history */}
              {(data.trace.strategy_history ?? []).length > 0 && (
                <div style={card}>
                  <div style={sectionLabel}>Strategy history</div>
                  <div style={{ display:"grid", gap:8 }}>
                    {(data.trace.strategy_history ?? []).map((item, i) => (
                      <StrategyItem key={i} item={item} index={i}/>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default function TracePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100vh", background:"#FAF9F5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#8A8785", fontFamily:"'DM Sans',sans-serif" }}>
        Loading trace…
      </div>
    }>
      <TracePageInner/>
    </Suspense>
  );
}
