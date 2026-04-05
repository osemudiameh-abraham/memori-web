"use client";

import { useEffect, useMemo, useState } from "react";

type FactEvidence = { fact_id: string; memory_id: string; created_at: string };
type FactRow = { id: string; user_id: string; fact_key: string; subject: string; attribute: string; value_text: string; canonical_text: string; confidence: number; evidence_count: number; status: string; supersedes_fact_id: string | null; created_at: string; updated_at: string; evidence: FactEvidence[] };
type IdentitySnapshot = { self_name: string | null; self_company: string | null; self_role: string | null; self_city: string | null; self_timezone: string | null };
type FactsResponse = { ok: true; facts: FactRow[]; identitySnapshot: IdentitySnapshot } | { ok: false; error: string };
type UpdateStatusResponse = { ok: true; fact: { id: string; fact_key: string; canonical_text: string; previous_status: string; next_status: string } } | { ok: false; error: string };

function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

const STATUS_META: Record<string,{bg:string;border:string;text:string;dot:string}> = {
  active:     { bg:"rgba(220,245,230,0.80)", border:"rgba(30,140,70,0.18)",  text:"#1A5C32", dot:"#2A9C52" },
  disputed:   { bg:"rgba(255,243,210,0.80)", border:"rgba(185,140,30,0.20)", text:"#6A4A00", dot:"#D4900A" },
  historical: { bg:"rgba(235,235,252,0.80)", border:"rgba(100,100,180,0.18)",text:"#2A2870", dot:"#5A58B0" },
  superseded: { bg:"rgba(245,238,238,0.80)", border:"rgba(160,100,100,0.18)",text:"#5A2020", dot:"#B05050" },
};

function FactCard({ fact, onRefresh }: { fact: FactRow; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const sm = STATUS_META[fact.status] ?? STATUS_META.historical;

  async function updateStatus(nextStatus: "active"|"historical"|"disputed") {
    const note = window.prompt(`Optional note for "${nextStatus}":`, "")?.trim() ?? "";
    setBusy(true);
    try {
      const res = await fetch("/api/facts/update-status", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ factId:fact.id, nextStatus, note }) });
      const json = (await res.json().catch(()=>({}))) as UpdateStatusResponse;
      if (!res.ok || json.ok===false) { alert(json.ok===false ? json.error : `Failed (HTTP ${res.status})`); return; }
      await onRefresh();
    } catch (e:unknown) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  const btnS = (color:string,bg:string,border:string): React.CSSProperties => ({ padding:"5px 11px", borderRadius:8, border:`1px solid ${border}`, background:bg, color, fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 120ms ease", opacity:busy?0.5:1 });

  return (
    <div style={{ background:"rgba(255,255,255,0.90)", border:"1px solid rgba(0,0,0,0.08)", borderRadius:14, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:500, fontSize:14, color:"#1C1A18", letterSpacing:"-0.1px", marginBottom:3 }}>{fact.fact_key}</div>
          <div style={{ fontSize:11.5, color:"#ABABAB" }}>{fact.subject} · {fact.attribute}</div>
        </div>
        <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:100, fontSize:11, fontWeight:600, letterSpacing:"0.07em", background:sm.bg, border:`1px solid ${sm.border}`, color:sm.text, whiteSpace:"nowrap", flexShrink:0 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:sm.dot, display:"inline-block" }}/>
          {fact.status}
        </span>
      </div>

      <div style={{ fontSize:16, color:"#1C1A18", marginBottom:5, lineHeight:1.5 }}>{fact.value_text}</div>
      <div style={{ fontSize:13, color:"#6B6865", lineHeight:1.55, marginBottom:10 }}>{fact.canonical_text}</div>

      <div style={{ display:"flex", gap:12, fontSize:12, color:"#ABABAB", marginBottom:12 }}>
        <span>Confidence: <strong style={{ color:"#3C3A38" }}>{Math.round(fact.confidence*100)}%</strong></span>
        <span>Evidence: <strong style={{ color:"#3C3A38" }}>{fact.evidence_count}</strong></span>
        <span>Updated: <strong style={{ color:"#3C3A38" }}>{fmt(fact.updated_at)}</strong></span>
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
        {fact.status!=="active"    && <button onClick={() => void updateStatus("active")}    disabled={busy} style={btnS("#1A5C32","rgba(20,140,60,0.08)","rgba(20,140,60,0.20)")}>Restore active</button>}
        {fact.status!=="historical"&& <button onClick={() => void updateStatus("historical")}disabled={busy} style={btnS("#2A2870","rgba(80,80,180,0.08)","rgba(80,80,180,0.20)")}>Mark historical</button>}
        {fact.status!=="disputed"  && <button onClick={() => void updateStatus("disputed")}  disabled={busy} style={btnS("#7A5500","rgba(180,140,0,0.08)","rgba(180,140,0,0.20)")}>Mark disputed</button>}
      </div>

      {fact.evidence.length > 0 && (
        <button onClick={() => setOpen(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#8A8785", padding:0, fontFamily:"'DM Sans',sans-serif" }}>
          {open ? "▾ Hide" : "▸ Show"} {fact.evidence.length} evidence link{fact.evidence.length!==1?"s":""}
        </button>
      )}
      {open && (
        <div style={{ marginTop:10, display:"grid", gap:6 }}>
          {fact.evidence.map((ev,i) => (
            <div key={i} style={{ padding:"8px 12px", borderRadius:9, background:"rgba(0,0,0,0.03)", border:"1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:11.5, color:"#8A8785", fontFamily:"monospace" }}>{ev.memory_id}</div>
              <div style={{ fontSize:11, color:"#ABABAB", marginTop:2 }}>linked {fmt(ev.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FactsPage() {
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"superseded"|"historical"|"disputed">("all");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FactsResponse|null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const qs = statusFilter==="all" ? "/api/facts?include_evidence=1" : `/api/facts?status=${encodeURIComponent(statusFilter)}&include_evidence=1`;
      const res = await fetch(qs, { method:"GET", credentials:"include" });
      const json = (await res.json().catch(()=>({}))) as FactsResponse;
      if (!res.ok) { setData({ ok:false, error:(json as {error?:string}).error ?? `Failed (HTTP ${res.status})` }); return; }
      setData(json);
    } catch (e:unknown) { setData({ ok:false, error:e instanceof Error?e.message:"Request failed" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [statusFilter]);

  const grouped = useMemo(() => {
    if (!data || data.ok===false) return { self:[] as FactRow[], people:[] as FactRow[], other:[] as FactRow[] };
    const self:FactRow[]=[], people:FactRow[]=[], other:FactRow[]=[];
    for (const f of data.facts) {
      if (f.subject==="self") self.push(f);
      else if (String(f.subject).startsWith("person:")) people.push(f);
      else other.push(f);
    }
    return { self, people, other };
  }, [data]);

  const snap = data?.ok ? data.identitySnapshot : null;

  const selS: React.CSSProperties = { padding:"7px 11px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", outline:"none" };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}html,body{height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#FAF9F5;color:#1C1A18;}`}</style>
      <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),#F5F4F0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom:"1px solid rgba(0,0,0,0.07)", background:"rgba(245,244,240,0.80)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10, gap:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/" style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, textDecoration:"none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Home
            </a>
            <span style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:500, color:"#2A2825" }}>Facts Audit</span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={selS}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="superseded">Superseded</option>
              <option value="historical">Historical</option>
              <option value="disputed">Disputed</option>
            </select>
            <a href="/trace" style={{ padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, textDecoration:"none" }}>Trace audit</a>
            <button onClick={() => void load()} disabled={loading} style={{ padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>{loading?"Loading…":"Refresh"}</button>
          </div>
        </div>

        <div style={{ maxWidth:760, margin:"0 auto", padding:"28px 24px 60px" }}>
          {snap && (
            <div style={{ background:"rgba(255,255,255,0.90)", border:"1px solid rgba(0,0,0,0.08)", borderRadius:16, padding:"18px 20px", marginBottom:24, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.09em", textTransform:"uppercase", color:"#ABABAB", marginBottom:12 }}>Identity snapshot</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"8px 16px" }}>
                {(["self_name","self_company","self_role","self_city","self_timezone"] as (keyof IdentitySnapshot)[]).map(k => (
                  <div key={k}>
                    <div style={{ fontSize:11, color:"#ABABAB", marginBottom:2 }}>{k.replace("self_","")}</div>
                    <div style={{ fontSize:14, fontWeight:500, color: snap[k] ? "#1C1A18" : "#DEDBD6" }}>{snap[k] ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data ? <div style={{ textAlign:"center", padding:48, color:"#8A8785", fontSize:14 }}>Loading…</div>
          : data.ok===false ? <div style={{ padding:"12px 16px", borderRadius:12, background:"rgba(255,240,240,0.95)", border:"1px solid rgba(185,60,60,0.18)", color:"#6A1A1A", fontSize:14 }}>{data.error}</div>
          : (
            <>
              {[{ key:"self", label:"Self facts", facts:grouped.self }, { key:"people", label:"People", facts:grouped.people }, { key:"other", label:"Other facts", facts:grouped.other }].map(({ key, label, facts }) => facts.length===0 ? null : (
                <div key={key} style={{ marginBottom:28 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                    <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:500, color:"#2A2825" }}>{label}</h2>
                    <span style={{ fontSize:12, color:"#ABABAB", background:"rgba(0,0,0,0.05)", borderRadius:100, padding:"1px 8px" }}>{facts.length}</span>
                  </div>
                  <div style={{ display:"grid", gap:10 }}>
                    {facts.map(f => <FactCard key={f.id} fact={f} onRefresh={load}/>)}
                  </div>
                </div>
              ))}
              {!grouped.self.length && !grouped.people.length && !grouped.other.length && (
                <div style={{ textAlign:"center", padding:48, color:"#8A8785", fontSize:14 }}>No facts found for this filter.</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
