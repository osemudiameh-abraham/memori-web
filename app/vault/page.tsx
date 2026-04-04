"use client";

import { useEffect, useState } from "react";

type Fact = { id: string; fact_key: string; subject: string; attribute: string; value_text: string; canonical_text: string; status: string; };
type FactsResponse = { ok: true; facts: Fact[] } | { ok: false; error: string };
type UpdateStatusResponse = { ok: true; fact: { id: string; fact_key: string; canonical_text: string; previous_status: string; next_status: string } } | { ok: false; error: string };

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  active:     { bg: "rgba(220,245,230,0.70)", border: "rgba(30,140,70,0.18)",  text: "#1A5C32", dot: "#2A9C52" },
  disputed:   { bg: "rgba(255,243,220,0.70)", border: "rgba(185,140,30,0.20)", text: "#6A4A00", dot: "#D4900A" },
  historical: { bg: "rgba(240,240,250,0.70)", border: "rgba(100,100,180,0.18)",text: "#2A2870", dot: "#5A58B0" },
  superseded: { bg: "rgba(245,240,240,0.70)", border: "rgba(160,100,100,0.18)",text: "#5A2020", dot: "#B05050" },
};

function FactCard({ fact, onRefresh }: { fact: Fact; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const s = STATUS_COLORS[fact.status] ?? STATUS_COLORS.historical;

  async function handle(nextStatus: "disputed" | "active" | "historical") {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/facts/update-status", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ factId: fact.id, nextStatus, note: "" }) });
      const json = (await res.json().catch(() => ({}))) as UpdateStatusResponse;
      if (!res.ok || json.ok === false) { alert(json.ok === false ? json.error : "Update failed"); return; }
      onRefresh();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ background:"rgba(255,255,255,0.90)", border:"1px solid rgba(0,0,0,0.08)", borderRadius:14, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:10 }}>
        <div style={{ fontWeight:500, fontSize:14, color:"#1C1A18", letterSpacing:"-0.1px" }}>{fact.fact_key}</div>
        <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:100, fontSize:11, fontWeight:600, letterSpacing:"0.07em", background:s.bg, border:`1px solid ${s.border}`, color:s.text, whiteSpace:"nowrap", flexShrink:0 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:s.dot, display:"inline-block" }}/>
          {fact.status}
        </span>
      </div>
      <div style={{ fontSize:16, color:"#1C1A18", marginBottom:6, lineHeight:1.5 }}>{fact.value_text}</div>
      <div style={{ fontSize:12.5, color:"#8A8785", lineHeight:1.55 }}>{fact.canonical_text}</div>
      <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
        {fact.status !== "disputed"  && <button onClick={() => handle("disputed")}  disabled={loading} style={btnStyle("#7A5500","rgba(180,140,0,0.08)","rgba(180,140,0,0.20)")}>{loading?"…":"Mark disputed"}</button>}
        {fact.status !== "active"    && <button onClick={() => handle("active")}    disabled={loading} style={btnStyle("#1A5C32","rgba(20,140,60,0.08)","rgba(20,140,60,0.20)")}>{loading?"…":"Restore active"}</button>}
        {fact.status !== "historical"&& <button onClick={() => handle("historical")}disabled={loading} style={btnStyle("#2A2870","rgba(80,80,180,0.08)","rgba(80,80,180,0.20)")}>{loading?"…":"Mark historical"}</button>}
      </div>
    </div>
  );
}

function btnStyle(color: string, bg: string, border: string): React.CSSProperties {
  return { padding:"6px 12px", borderRadius:9, border:`1px solid ${border}`, background:bg, color, fontSize:12.5, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 130ms ease" };
}

function Section({ title, facts, onRefresh, icon }: { title: string; facts: Fact[]; onRefresh: () => void; icon: string }) {
  if (facts.length === 0) return null;
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:14 }}>{icon}</span>
        <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:500, color:"#2A2825", letterSpacing:"-0.1px" }}>{title}</h2>
        <span style={{ fontSize:12, color:"#ABABAB", background:"rgba(0,0,0,0.05)", borderRadius:100, padding:"1px 8px" }}>{facts.length}</span>
      </div>
      <div style={{ display:"grid", gap:10 }}>
        {facts.map(f => <FactCard key={f.id} fact={f} onRefresh={onRefresh}/>)}
      </div>
    </div>
  );
}

export default function VaultPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/facts?include_evidence=0", { credentials:"include" });
      const data = (await res.json().catch(() => ({}))) as FactsResponse;
      if (!res.ok || data.ok === false) { setError((data as {error?:string}).error ?? "Failed to load"); return; }
      setFacts(data.ok ? data.facts : []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const active = facts.filter(f => f.status === "active");
  const disputed = facts.filter(f => f.status === "disputed");
  const historical = facts.filter(f => f.status === "historical");
  const superseded = facts.filter(f => f.status === "superseded");

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}html,body{height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#F5F4F0;color:#1C1A18;}`}</style>
      <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),#F5F4F0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom:"1px solid rgba(0,0,0,0.07)", background:"rgba(245,244,240,0.80)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/" style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, textDecoration:"none", transition:"all 130ms ease" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Home
            </a>
            <span style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:500, color:"#2A2825" }}>Memory Vault</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <a href="/facts" style={{ padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, textDecoration:"none" }}>Facts audit</a>
            <button onClick={() => void load()} disabled={loading} style={{ padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>{loading?"Loading…":"Refresh"}</button>
          </div>
        </div>
        <div style={{ maxWidth:680, margin:"0 auto", padding:"32px 24px 60px" }}>
          <p style={{ fontSize:14, color:"#8A8785", marginBottom:28, lineHeight:1.55 }}>Everything Memori knows about you — view and correct any fact at any time.</p>
          {error && <div style={{ padding:"12px 16px", borderRadius:12, background:"rgba(255,240,240,0.95)", border:"1px solid rgba(185,60,60,0.18)", color:"#6A1A1A", fontSize:14, marginBottom:20 }}>{error}</div>}
          {loading && !facts.length ? <div style={{ textAlign:"center", padding:40, color:"#8A8785", fontSize:14 }}>Loading…</div> : (
            <>
              <Section title="Active facts" facts={active} onRefresh={load} icon="✦"/>
              <Section title="Disputed" facts={disputed} onRefresh={load} icon="⚑"/>
              <Section title="Historical" facts={historical} onRefresh={load} icon="◷"/>
              <Section title="Superseded" facts={superseded} onRefresh={load} icon="↺"/>
              {!facts.length && <div style={{ textAlign:"center", padding:40, color:"#8A8785", fontSize:14 }}>No facts stored yet. Start a conversation to build your memory.</div>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
