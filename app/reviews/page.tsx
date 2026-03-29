"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ReviewDecision = {
  id: string;
  text: string;
  review_due_at: string | null;
  expected_outcome: string | null;
};

type LoadResponse =
  | {
      ok: true;
      decision: ReviewDecision | null;
    }
  | {
      ok: false;
      error: string;
    };

type SubmitResponse =
  | {
      ok: true;
      outcome_id: string | null;
    }
  | {
      ok: false;
      error: string;
    };

function fmt(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

export default function ReviewsPage() {
  const searchParams = useSearchParams();
  const focusId = (searchParams.get("focus") ?? "").trim();

  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setStatus("");

    try {
      const url = focusId
        ? `/api/reviews/load?focus=${encodeURIComponent(focusId)}`
        : "/api/reviews/load";

      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      const json = (await res.json().catch(() => ({}))) as LoadResponse;

      if (!res.ok || json.ok === false) {
        setStatus(json.ok === false ? json.error : `Load failed (HTTP ${res.status})`);
        setDecision(null);
        return;
      }

      setDecision(json.decision);
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Load failed");
      setDecision(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [focusId]);

  async function submit(outcomeLabel: "worked" | "failed" | "partial") {
    if (!decision || busy) return;

    setBusy(true);
    setStatus("");

    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decisionId: decision.id,
          outcomeLabel,
          note,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as SubmitResponse;

      if (!res.ok || json.ok === false) {
        setStatus(json.ok === false ? json.error : `Submit failed (HTTP ${res.status})`);
        return;
      }

      setStatus("Review saved.");
      setNote("");
      await load();
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Decision Reviews</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Review prior decisions and record what happened.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => (window.location.href = "/")}>Back</button>
          <button onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {status && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          {status}
        </div>
      )}

      {!loading && !decision && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          No due decisions right now.
        </div>
      )}

      {decision && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Due: <strong>{fmt(decision.review_due_at)}</strong>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
              <strong>Decision</strong>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{decision.text}</div>
          </div>

          {decision.expected_outcome && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
                <strong>Expected outcome</strong>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{decision.expected_outcome}</div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
              <strong>Review note</strong>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              style={{ width: "100%" }}
              placeholder="What happened?"
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={() => void submit("worked")} disabled={busy}>
              {busy ? "Saving..." : "Worked"}
            </button>

            <button onClick={() => void submit("partial")} disabled={busy}>
              {busy ? "Saving..." : "Partial"}
            </button>

            <button onClick={() => void submit("failed")} disabled={busy}>
              {busy ? "Saving..." : "Failed"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
