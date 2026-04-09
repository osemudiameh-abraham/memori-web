"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

interface TraceItem {
  id: string;
  created_at: string;
  query_text: string;
  assistant_text: string;
  picked_memory_ids?: string[];
  strategy_history?: unknown[];
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(iso); }
}

export default function TracePage() {
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/trace/recent", { credentials: "include" });
        if (res.ok) {
          const d = await res.json() as { traces?: TraceItem[]; items?: TraceItem[] };
          setTraces(d.traces ?? d.items ?? []);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppShell>
      <div style={{ flex: 1, padding: "40px 32px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            Governance Trace
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Understand exactly why Seven said what it said.
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "3px solid rgba(0,0,0,0.1)",
              borderTopColor: "var(--blue)",
              animation: "spin 0.8s linear infinite",
            }} />
          </div>
        ) : traces.length === 0 ? (
          <div style={{
            background: "var(--surface)", borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)", padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>No trace data yet</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Traces are created as you chat with Seven.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {traces.map(trace => (
              <div
                key={trace.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--radius-card)",
                  boxShadow: "var(--shadow-card)",
                  overflow: "hidden",
                }}
              >
                {/* Row */}
                <button
                  onClick={() => toggle(trace.id)}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "18px 24px",
                    display: "flex", alignItems: "flex-start",
                    justifyContent: "space-between", gap: 12,
                    background: "none", cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 15, fontWeight: 500, color: "var(--text-primary)",
                      marginBottom: 4, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {trace.query_text}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmt(trace.created_at)}</p>
                  </div>
                  <span style={{
                    fontSize: 13, color: "var(--blue)", fontWeight: 500,
                    flexShrink: 0, paddingTop: 2,
                  }}>
                    {expanded.has(trace.id) ? "Hide ▲" : "Why this? ▼"}
                  </span>
                </button>

                {/* Expanded detail */}
                {expanded.has(trace.id) && (
                  <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", padding: "20px 24px" }}>
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                        Seven responded
                      </p>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                        {trace.assistant_text}
                      </p>
                    </div>

                    {(trace.picked_memory_ids ?? []).length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Memories used ({trace.picked_memory_ids!.length})
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {trace.picked_memory_ids!.map(id => (
                            <span key={id} style={{
                              background: "var(--blue-light)", color: "var(--blue)",
                              borderRadius: "var(--radius-pill)", padding: "3px 10px",
                              fontSize: 11, fontFamily: "monospace",
                            }}>
                              {id.slice(0, 8)}…
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(trace.strategy_history) && trace.strategy_history.length > 0 && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Strategy steps
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {trace.strategy_history.map((step, i) => (
                            <div key={i} style={{
                              background: "var(--bg)", borderRadius: 10, padding: "8px 12px",
                              fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace",
                            }}>
                              {JSON.stringify(step)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}
