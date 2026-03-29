"use client";

import { useEffect, useState } from "react";

type Fact = {
  id: string;
  fact_key: string;
  subject: string;
  attribute: string;
  value_text: string;
  canonical_text: string;
  status: string;
};

type FactsResponse =
  | { ok: true; facts: Fact[] }
  | { ok: false; error: string };

type UpdateStatusResponse =
  | {
      ok: true;
      fact: {
        id: string;
        fact_key: string;
        canonical_text: string;
        previous_status: string;
        next_status: string;
      };
    }
  | { ok: false; error: string };

async function updateStatus(factId: string, nextStatus: string) {
  const res = await fetch("/api/facts/update-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ factId, nextStatus, note: "" }),
  });

  const json = (await res.json().catch(() => ({}))) as UpdateStatusResponse;
  if (!res.ok || json.ok === false) {
    throw new Error(json.ok === false ? json.error : "Update failed");
  }
}

function FactCard({
  fact,
  onRefresh,
}: {
  fact: Fact;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handle(nextStatus: "disputed" | "active" | "historical") {
    if (loading) return;
    setLoading(true);
    try {
      await updateStatus(fact.id, nextStatus);
      onRefresh();
    } catch (e: any) {
      alert(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: 12,
        borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 600 }}>{fact.fact_key}</div>

      <div style={{ marginTop: 6 }}>
        <strong>Value:</strong> {fact.value_text}
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        {fact.canonical_text}
      </div>

      <div style={{ fontSize: 12, marginTop: 6 }}>
        status: <strong>{fact.status}</strong>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {fact.status !== "disputed" && (
          <button onClick={() => handle("disputed")} disabled={loading}>
            Mark disputed
          </button>
        )}

        {fact.status !== "active" && (
          <button onClick={() => handle("active")} disabled={loading}>
            Restore active
          </button>
        )}

        {fact.status !== "historical" && (
          <button onClick={() => handle("historical")} disabled={loading}>
            Mark historical
          </button>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  facts,
  onRefresh,
}: {
  title: string;
  facts: Fact[];
  onRefresh: () => void;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2>{title}</h2>

      {facts.length === 0 ? (
        <div style={{ opacity: 0.6 }}>No facts</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {facts.map((f) => (
            <FactCard key={f.id} fact={f} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function VaultPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/facts?include_evidence=0", {
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as FactsResponse;

      if (!res.ok || data.ok === false) {
        setError((data as any)?.error ?? "Failed to load facts");
        return;
      }

      setFacts(data.facts ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load facts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const active = facts.filter((f) => f.status === "active");
  const disputed = facts.filter((f) => f.status === "disputed");
  const historical = facts.filter((f) => f.status === "historical");
  const superseded = facts.filter((f) => f.status === "superseded");

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>Memory Vault</h1>

      <div style={{ marginTop: 8, opacity: 0.7 }}>
        View and manage what Memori knows about you.
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => void load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <button onClick={() => (window.location.href = "/")}>Home</button>

        <button onClick={() => (window.location.href = "/facts")}>
          Facts audit
        </button>

        <button onClick={() => (window.location.href = "/onboarding")}>
          Onboarding
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "red" }}>
          {error}
        </div>
      )}

      <Section title="Active facts" facts={active} onRefresh={load} />
      <Section title="Disputed facts" facts={disputed} onRefresh={load} />
      <Section title="Historical facts" facts={historical} onRefresh={load} />
      <Section title="Superseded facts" facts={superseded} onRefresh={load} />
    </main>
  );
}