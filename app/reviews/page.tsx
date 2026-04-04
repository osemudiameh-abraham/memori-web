"use client";

import { useEffect, useState } from "react";

type Decision = {
  id: string;
  text: string;
  review_due_at: string | null;
  expected_outcome: string | null;
  reviewed_at?: string | null;
  outcome_count?: number;
  pattern_signal?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function ReviewsPage() {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setSubmitted(false);
    try {
      const params = new URLSearchParams(window.location.search);
      const focus = params.get("focus");
      const url = focus ? `/api/reviews/load?focus=${encodeURIComponent(focus)}` : "/api/reviews/load";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.ok) { setDecision(null); setError(data?.error ?? "Unable to load reviews."); return; }
      setDecision(data.decision);
    } catch { setDecision(null); setError("Unable to load reviews."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function submit(outcomeLabel: "worked" | "failed" | "partial") {
    if (!decision) return;
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.id, outcomeLabel, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setError(data?.error ?? "Unable to submit review."); return; }
      setNote("");
      setSubmitted(true);
      setTimeout(() => void load(), 1200);
    } catch { setError("Unable to submit review."); }
    finally { setSubmitting(false); }
  }

  const outcomeButtons = [
    { label: "Worked", value: "worked" as const, color: "#1C6B3A", bg: "rgba(20,100,50,0.08)", border: "rgba(20,100,50,0.18)" },
    { label: "Partial", value: "partial" as const, color: "#7A5B00", bg: "rgba(180,140,0,0.08)", border: "rgba(180,140,0,0.18)" },
    { label: "Failed", value: "failed" as const, color: "#8B1A1A", bg: "rgba(160,30,30,0.08)", border: "rgba(160,30,30,0.18)" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#F5F4F0;color:#1C1A18;}
        .page{min-height:100vh;background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),#F5F4F0;padding:0 0 60px;}
        .topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid rgba(0,0,0,0.07);background:rgba(245,244,240,0.80);backdrop-filter:blur(20px);position:sticky;top:0;z-index:10;}
        .topbar-left{display:flex;align-items:center;gap:10px;}
        .back-btn{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;border:1px solid rgba(0,0,0,0.12);background:rgba(255,255,255,0.70);color:#3C3A38;font-size:13.5px;font-weight:400;cursor:pointer;font-family:inherit;text-decoration:none;transition:all 130ms ease;}
        .back-btn:hover{background:rgba(255,255,255,1);color:#1C1A18;}
        .page-title{font-family:'Lora',Georgia,serif;font-size:17px;font-weight:500;color:#2A2825;letter-spacing:-0.1px;}
        .content{max-width:620px;margin:0 auto;padding:32px 24px;}
        .card{background:rgba(255,255,255,0.90);border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
        .card+.card{margin-top:12px;}
        .card-label{font-size:11px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#ABABAB;margin-bottom:8px;}
        .card-text{font-size:16px;line-height:1.60;color:#1C1A18;}
        .due-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:100px;background:rgba(0,0,0,0.05);font-size:12px;color:#6B6865;margin-bottom:20px;}
        .pattern-card{background:rgba(255,250,220,0.90);border:1px solid rgba(185,165,60,0.20);border-radius:14px;padding:16px;}
        .pattern-label{font-size:11px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#7A6500;margin-bottom:6px;}
        .pattern-text{font-size:14.5px;line-height:1.58;color:#4A3D00;}
        .note-label{font-size:13px;font-weight:500;color:#4A4845;margin-bottom:8px;}
        .note-area{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.12);background:rgba(255,255,255,0.80);font-family:'DM Sans',sans-serif;font-size:15px;color:#1C1A18;resize:none;outline:none;line-height:1.55;transition:border-color 150ms ease;}
        .note-area:focus{border-color:rgba(0,0,0,0.24);}
        .note-area::placeholder{color:#B0ADA8;}
        .outcome-row{display:flex;gap:10px;flex-wrap:wrap;}
        .outcome-btn{flex:1;min-width:90px;padding:12px 10px;border-radius:12px;border-width:1.5px;border-style:solid;font-family:'DM Sans',sans-serif;font-size:14.5px;font-weight:500;cursor:pointer;transition:all 140ms ease;}
        .outcome-btn:disabled{opacity:0.5;cursor:not-allowed;}
        .outcome-btn:not(:disabled):hover{filter:brightness(0.95);transform:translateY(-1px);}
        .error-box{padding:12px 16px;border-radius:12px;background:rgba(255,240,240,0.95);border:1px solid rgba(185,60,60,0.18);color:#6A1A1A;font-size:14px;}
        .success-box{padding:16px;border-radius:14px;background:rgba(220,245,230,0.95);border:1px solid rgba(30,140,70,0.18);color:#1A5C32;font-size:15px;text-align:center;}
        .empty-state{text-align:center;padding:60px 20px;}
        .empty-icon{font-size:36px;margin-bottom:16px;}
        .empty-title{font-family:'Lora',Georgia,serif;font-size:22px;font-weight:400;color:#2A2825;margin-bottom:8px;}
        .empty-sub{font-size:15px;color:#8A8785;line-height:1.55;}
        .section-gap{height:16px;}
      `}</style>

      <div className="page">
        <div className="topbar">
          <div className="topbar-left">
            <a href="/" className="back-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Home
            </a>
            <span className="page-title">Decision Reviews</span>
          </div>
          <button className="back-btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Next review"}
          </button>
        </div>

        <div className="content">
          {loading ? (
            <div className="empty-state">
              <div style={{ fontSize:14, color:"#8A8785" }}>Loading…</div>
            </div>
          ) : error && !decision ? (
            <div className="error-box">{error}</div>
          ) : submitted ? (
            <div className="success-box">
              <div style={{ fontSize:24, marginBottom:8 }}>✓</div>
              <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:18, marginBottom:6 }}>Review submitted</div>
              <div style={{ fontSize:14, color:"#2A7A4A" }}>Loading next decision…</div>
            </div>
          ) : !decision ? (
            <div className="empty-state">
              <div className="empty-icon">⚖️</div>
              <div className="empty-title">All caught up</div>
              <div className="empty-sub">No decisions are due for review right now.<br/>Check back after you log more decisions.</div>
            </div>
          ) : (
            <>
              <div className="due-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Due {formatDate(decision.review_due_at)}
              </div>

              {error && <div className="error-box" style={{ marginBottom:12 }}>{error}</div>}

              <div className="card">
                <div className="card-label">Decision</div>
                <div className="card-text">{decision.text}</div>
              </div>

              {decision.expected_outcome && (
                <div className="card" style={{ background:"rgba(248,248,255,0.90)", borderColor:"rgba(100,100,200,0.12)" }}>
                  <div className="card-label">Expected outcome</div>
                  <div className="card-text" style={{ fontSize:15 }}>{decision.expected_outcome}</div>
                </div>
              )}

              <div className="card" style={{ padding:"14px 20px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div className="card-label" style={{ margin:0 }}>Review history</div>
                  <div style={{ fontFamily:"'Lora',Georgia,serif", fontSize:22, fontWeight:400, color:"#2A2825" }}>{decision.outcome_count ?? 0}</div>
                </div>
                <div style={{ fontSize:12.5, color:"#8A8785", marginTop:2 }}>time{(decision.outcome_count ?? 0) !== 1 ? "s" : ""} reviewed</div>
              </div>

              {decision.pattern_signal && (
                <div className="pattern-card">
                  <div className="pattern-label">Pattern detected</div>
                  <div className="pattern-text">{decision.pattern_signal}</div>
                </div>
              )}

              <div className="section-gap"/>

              <div style={{ marginBottom:10 }}>
                <div className="note-label">Add a note (optional)</div>
                <textarea
                  className="note-area"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="What happened? What did you learn?"
                />
              </div>

              <div className="outcome-row">
                {outcomeButtons.map(({ label, value, color, bg, border }) => (
                  <button
                    key={value}
                    className="outcome-btn"
                    disabled={submitting}
                    onClick={() => void submit(value)}
                    style={{ color, background: bg, borderColor: border }}
                  >
                    {submitting ? "Saving…" : label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
