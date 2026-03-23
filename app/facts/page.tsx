"use client";

import { useEffect, useMemo, useState } from "react";

type FactEvidence = {
  fact_id: string;
  memory_id: string;
  created_at: string;
};

type FactRow = {
  id: string;
  user_id: string;
  fact_key: string;
  subject: string;
  attribute: string;
  value_text: string;
  canonical_text: string;
  confidence: number;
  evidence_count: number;
  status: string;
  supersedes_fact_id: string | null;
  created_at: string;
  updated_at: string;
  evidence: FactEvidence[];
};

type FactsResponse =
  | {
      ok: true;
      facts: FactRow[];
      identitySnapshot: {
        self_name: string | null;
        self_company: string | null;
        self_role: string | null;
        self_city: string | null;
        self_timezone: string | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

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
  | {
      ok: false;
      error: string;
    };

function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function FactCard(props: {
  fact: FactRow;
  onRefresh: () => Promise<void>;
}) {
  const { fact, onRefresh } = props;
  const [busy, setBusy] = useState(false);

  async function updateStatus(nextStatus: "active" | "historical" | "disputed") {
    const note =
      window.prompt(`Optional note for ${nextStatus}:`, "")?.trim() ?? "";

    setBusy(true);
    try {
      const res = await fetch("/api/facts/update-status", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          factId: fact.id,
          nextStatus,
          note,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as UpdateStatusResponse;

      if (!res.ok || json.ok === false) {
        alert(json.ok === false ? json.error : `Status update failed (HTTP ${res.status})`);
        return;
      }

      await onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Status update failed";
      alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{fact.fact_key}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            subject: {fact.subject} · attribute: {fact.attribute}
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          status: <strong>{fact.status}</strong>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div>
          <strong>Value:</strong> {fact.value_text}
        </div>
        <div style={{ marginTop: 4 }}>
          <strong>Canonical text:</strong> {fact.canonical_text}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
        confidence: <strong>{fact.confidence}</strong> · evidence_count: <strong>{fact.evidence_count}</strong>
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
        created: {fmt(fact.created_at)} · updated: {fmt(fact.updated_at)}
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
        supersedes_fact_id: {fact.supersedes_fact_id ?? "none"}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {fact.status !== "active" && (
          <button onClick={() => void updateStatus("active")} disabled={busy}>
            {busy ? "Working..." : "Restore active"}
          </button>
        )}

        {fact.status !== "historical" && (
          <button onClick={() => void updateStatus("historical")} disabled={busy}>
            {busy ? "Working..." : "Mark historical"}
          </button>
        )}

        {fact.status !== "disputed" && (
          <button onClick={() => void updateStatus("disputed")} disabled={busy}>
            {busy ? "Working..." : "Mark disputed"}
          </button>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
          <strong>Evidence links</strong>
        </div>

        {fact.evidence.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No evidence rows linked.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {fact.evidence.map((ev, i) => (
              <div
                key={`${ev.fact_id}-${ev.memory_id}-${i}`}
                style={{ padding: 8, border: "1px solid #f0f0f0", borderRadius: 6 }}
              >
                <div style={{ fontSize: 12, opacity: 0.75 }}>memory_id: {ev.memory_id}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>linked: {fmt(ev.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FactsPage() {
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "superseded" | "historical" | "disputed"
  >("all");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FactsResponse | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const qs =
        statusFilter === "all"
          ? "/api/facts?include_evidence=1"
          : `/api/facts?status=${encodeURIComponent(statusFilter)}&include_evidence=1`;

      const res = await fetch(qs, {
        method: "GET",
        credentials: "include",
      });

      const json = (await res.json().catch(() => ({}))) as FactsResponse;

      if (!res.ok) {
        const msg = (json as any)?.error ?? `Facts request failed (HTTP ${res.status})`;
        setData({ ok: false, error: msg });
        return;
      }

      setData(json);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Facts request failed";
      setData({ ok: false, error: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [statusFilter]);

  const grouped = useMemo(() => {
    if (!data || data.ok === false) {
      return { self: [] as FactRow[], people: [] as FactRow[], other: [] as FactRow[] };
    }

    const self: FactRow[] = [];
    const people: FactRow[] = [];
    const other: FactRow[] = [];

    for (const fact of data.facts) {
      if (fact.subject === "self") self.push(fact);
      else if (String(fact.subject).startsWith("person:")) people.push(fact);
      else other.push(fact);
    }

    return { self, people, other };
  }, [data]);

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Canonical Facts Audit</h1>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Governance view for active, superseded, historical, and disputed semantic memory.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "active" | "superseded" | "historical" | "disputed"
              )
            }
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="superseded">Superseded only</option>
            <option value="historical">Historical only</option>
            <option value="disputed">Disputed only</option>
          </select>

          <button onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button onClick={() => (window.location.href = "/trace")}>Trace audit</button>
          <button onClick={() => (window.location.href = "/")}>Back</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {!data ? (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>No data yet.</div>
        ) : data.ok === false ? (
          <div
            style={{
              padding: 12,
              border: "1px solid #f5c2c7",
              background: "#f8d7da",
              borderRadius: 8,
            }}
          >
            <strong>Error:</strong> {data.error}
          </div>
        ) : (
          <>
            <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <h2 style={{ marginTop: 0 }}>Identity snapshot completeness</h2>

              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <strong>self_name:</strong>{" "}
                  {data.identitySnapshot.self_name ?? <span style={{ opacity: 0.7 }}>missing</span>}
                </div>
                <div>
                  <strong>self_company:</strong>{" "}
                  {data.identitySnapshot.self_company ?? <span style={{ opacity: 0.7 }}>missing</span>}
                </div>
                <div>
                  <strong>self_role:</strong>{" "}
                  {data.identitySnapshot.self_role ?? <span style={{ opacity: 0.7 }}>missing</span>}
                </div>
                <div>
                  <strong>self_city:</strong>{" "}
                  {data.identitySnapshot.self_city ?? <span style={{ opacity: 0.7 }}>missing</span>}
                </div>
                <div>
                  <strong>self_timezone:</strong>{" "}
                  {data.identitySnapshot.self_timezone ?? <span style={{ opacity: 0.7 }}>missing</span>}
                </div>
              </div>
            </section>

            <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <h2 style={{ marginTop: 0 }}>Self facts</h2>
              {grouped.self.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No self facts found.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {grouped.self.map((fact) => (
                    <FactCard key={fact.id} fact={fact} onRefresh={load} />
                  ))}
                </div>
              )}
            </section>

            <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <h2 style={{ marginTop: 0 }}>Person facts</h2>
              {grouped.people.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No person facts found.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {grouped.people.map((fact) => (
                    <FactCard key={fact.id} fact={fact} onRefresh={load} />
                  ))}
                </div>
              )}
            </section>

            <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <h2 style={{ marginTop: 0 }}>Other facts</h2>
              {grouped.other.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No other facts found.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {grouped.other.map((fact) => (
                    <FactCard key={fact.id} fact={fact} onRefresh={load} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
