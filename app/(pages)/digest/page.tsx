"use client";

import { useEffect, useState } from "react";

type DigestFact = {
  text: string;
  created_at: string;
};

type DigestDecision = {
  text_snapshot: string;
  created_at: string;
};

type DigestOutcome = {
  text_snapshot: string;
  outcome_label: string;
  created_at: string;
};

type DigestSummary = {
  facts: DigestFact[];
  decisions: DigestDecision[];
  outcomes: DigestOutcome[];
  insight: string;
  counts: {
    facts: number;
    decisions: number;
    outcomes: number;
  };
  window: {
    since: string;
    until: string;
  };
};

type DigestResponse =
  | {
      ok: true;
      summary: DigestSummary;
    }
  | {
      ok: false;
      error: string;
    };

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function Section(props: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{props.title}</h2>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{props.count}</span>
      </div>

      {props.count === 0 ? (
        <div
          style={{
            padding: 12,
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            background: "#fafafa",
            fontSize: 14,
            opacity: 0.8,
          }}
        >
          {props.emptyText}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>{props.children}</div>
      )}
    </section>
  );
}

function Item(props: {
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{props.children}</div>
      {props.meta ? (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>{props.meta}</div>
      ) : null}
    </div>
  );
}

export default function DigestPage() {
  const [data, setData] = useState<DigestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDigest() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/digest/weekly", {
        credentials: "include",
      });

      const payload = (await res.json().catch(() => ({}))) as DigestResponse;

      if (!res.ok || payload.ok === false) {
        setData(null);
        setError(payload.ok === false ? payload.error : "Unable to load digest.");
        return;
      }

      setData(payload.summary);
    } catch {
      setData(null);
      setError("Unable to load digest.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDigest();
  }, []);

  return (
    <main style={{ maxWidth: 860, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Your Week with Memori</h1>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.7 }}>
            Weekly memory digest preview from your recent activity.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => void loadDigest()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button onClick={() => (window.location.href = "/")}>Back home</button>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 20 }}>Loading...</div>
      ) : error ? (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            border: "1px solid #f0d0d0",
            background: "#fff5f5",
            borderRadius: 10,
          }}
        >
          {error}
        </div>
      ) : !data ? (
        <div style={{ marginTop: 20 }}>No data.</div>
      ) : (
        <div style={{ marginTop: 20, display: "grid", gap: 20 }}>
          <div
            style={{
              padding: 16,
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              background: "#fafafa",
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.7 }}>Insight</div>
            <div style={{ marginTop: 8, fontSize: 18, lineHeight: 1.5 }}>{data.insight}</div>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
              Window: {formatDate(data.window.since)} → {formatDate(data.window.until)}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 12,
                border: "1px solid #e5e5e5",
                borderRadius: 10,
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>Facts learned</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>{data.counts.facts}</div>
            </div>

            <div
              style={{
                padding: 12,
                border: "1px solid #e5e5e5",
                borderRadius: 10,
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>Decisions made</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>{data.counts.decisions}</div>
            </div>

            <div
              style={{
                padding: 12,
                border: "1px solid #e5e5e5",
                borderRadius: 10,
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>Outcomes logged</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>{data.counts.outcomes}</div>
            </div>
          </div>

          <Section
            title="What Memori learned"
            count={data.facts.length}
            emptyText="No new facts were learned this week."
          >
            {data.facts.map((fact, index) => (
              <Item key={`${fact.created_at}-${index}`} meta={formatDate(fact.created_at)}>
                {fact.text}
              </Item>
            ))}
          </Section>

          <Section
            title="Decisions you made"
            count={data.decisions.length}
            emptyText="No decisions were logged this week."
          >
            {data.decisions.map((decision, index) => (
              <Item key={`${decision.created_at}-${index}`} meta={formatDate(decision.created_at)}>
                {decision.text_snapshot}
              </Item>
            ))}
          </Section>

          <Section
            title="Outcomes logged"
            count={data.outcomes.length}
            emptyText="No outcomes were logged this week."
          >
            {data.outcomes.map((outcome, index) => (
              <Item
                key={`${outcome.created_at}-${index}`}
                meta={`${outcome.outcome_label} • ${formatDate(outcome.created_at)}`}
              >
                {outcome.text_snapshot}
              </Item>
            ))}
          </Section>
        </div>
      )}
    </main>
  );
}