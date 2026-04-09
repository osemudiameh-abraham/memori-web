"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

interface Decision {
  id: string;
  text: string;
  review_due_at: string | null;
  expected_outcome: string | null;
  outcome_count?: number;
  pattern_signal?: string | null;
}

function formatDate(v: string | null | undefined) {
  if (!v) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(v));
  } catch { return v; }
}

type Outcome = "worked" | "failed" | "mixed" | "skip";

const OUTCOME_BTNS: { id: Outcome; emoji: string; label: string; color: string; bg: string }[] = [
  { id: "worked", emoji: "✓", label: "Worked",  color: "var(--green)",           bg: "rgba(52,168,83,0.1)" },
  { id: "failed", emoji: "✗", label: "Failed",  color: "var(--red)",             bg: "rgba(234,67,53,0.1)" },
  { id: "mixed",  emoji: "~", label: "Mixed",   color: "var(--yellow)",          bg: "rgba(251,188,4,0.1)" },
  { id: "skip",   emoji: "→", label: "Skip",    color: "var(--text-muted)",      bg: "rgba(0,0,0,0.05)" },
];

export default function ReviewsPage() {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [firstRes, countRes, todayRes] = await Promise.all([
        fetch("/api/reviews/first-due", { credentials: "include" }),
        fetch("/api/reviews/due-count", { credentials: "include" }),
        fetch("/api/reviews/completed-today", { credentials: "include" }),
      ]);

      if (countRes.ok) {
        const d = await countRes.json() as { count?: number; due_count?: number };
        setDueCount(d.count ?? d.due_count ?? 0);
      }

      if (todayRes.ok) {
        const d = await todayRes.json() as { completed?: boolean; completed_today?: boolean; streak?: number };
        setStreak(d.streak ?? 0);
        if (d.completed ?? d.completed_today) { setDone(true); setLoading(false); return; }
      }

      if (firstRes.ok) {
        const d = await firstRes.json() as { decision?: Decision; ok?: boolean };
        setDecision(d.decision ?? null);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleOutcome = async (outcome: Outcome) => {
    if (!decision || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/reviews/submit", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision_id: decision.id, outcome }),
      });
      if (outcome === "skip") {
        await load();
      } else {
        setDone(true);
        setDueCount(c => Math.max(0, c - 1));
      }
    } catch {}
    setSubmitting(false);
  };

  return (
    <AppShell reviewBadge={dueCount}>
      <div style={{ flex: 1, padding: "40px 32px", maxWidth: 680, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            Decision Reviews
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Reflect on past decisions to build better judgment over time.
          </p>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(251,188,4,0.12)", borderRadius: "var(--radius-pill)",
            padding: "6px 16px", marginBottom: 24,
          }}>
            <span style={{ fontSize: 16 }}>🔥</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#a06000" }}>
              {streak}-day review streak
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "3px solid rgba(0,0,0,0.1)",
              borderTopColor: "var(--blue)",
              animation: "spin 0.8s linear infinite",
            }} />
          </div>
        ) : done ? (
          <div style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: "48px 32px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
              All caught up!
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {dueCount > 0 ? `${dueCount} review${dueCount > 1 ? "s" : ""} still pending.` : "No more reviews due today."}
            </p>
          </div>
        ) : !decision ? (
          <div style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h2 style={{ fontSize: 20, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
              No reviews due
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Log decisions in your chat and Seven will remind you to review them.
            </p>
          </div>
        ) : (
          /* Decision card */
          <div style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: "32px",
            marginBottom: 24,
          }}>
            {decision.review_due_at && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Due {formatDate(decision.review_due_at)}
              </p>
            )}
            <p style={{ fontSize: 18, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 16, fontWeight: 400 }}>
              {decision.text}
            </p>
            {decision.expected_outcome && (
              <div style={{
                background: "var(--blue-light)", borderRadius: 12,
                padding: "10px 14px", marginBottom: 24,
              }}>
                <p style={{ fontSize: 13, color: "var(--blue)", lineHeight: 1.5 }}>
                  Expected: {decision.expected_outcome}
                </p>
              </div>
            )}
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 14 }}>
              How did it go?
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {OUTCOME_BTNS.map(btn => (
                <button
                  key={btn.id}
                  onClick={() => handleOutcome(btn.id)}
                  disabled={submitting}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: btn.bg, color: btn.color,
                    borderRadius: "var(--radius-pill)",
                    padding: "10px 18px", fontSize: 14, fontWeight: 500,
                    border: `1px solid ${btn.color}40`,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                    transition: "opacity var(--transition)",
                  }}
                >
                  <span>{btn.emoji}</span>
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pattern signal */}
        {decision?.pattern_signal && (
          <div style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: "20px 24px",
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              Pattern signal
            </p>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {decision.pattern_signal}
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}
