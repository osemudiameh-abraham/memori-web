"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Trace = {
  id: string;
  created_at: string;
  query_text: string;
  assistant_text: string;
  picked_memory_ids: string[];
  strategy_history: any[];
};

type TraceResponse =
  | { ok: true; trace: Trace }
  | { ok: false; error: string };

function fmt(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

export default function TracePage() {
  const searchParams = useSearchParams();
  const traceId = (searchParams.get("id") ?? "").trim();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TraceResponse | null>(null);

  async function load() {
    if (!traceId) {
      setData({
        ok: false,
        error: "Missing trace id. Go back and open this page from a chat response.",
      });
      return;
    }

    setLoading(true);
    try {
      const url = `/api/trace/${encodeURIComponent(traceId)}`;
      const res = await fetch(url, { method: "GET", credentials: "include" });

      const json = (await res.json().catch(() => ({}))) as TraceResponse;

      if (!res.ok) {
        const msg = (json as any)?.error ?? `Trace request failed (HTTP ${res.status})`;
        setData({ ok: false, error: msg });
        return;
      }

      setData(json);
    } catch (e: any) {
      setData({ ok: false, error: e?.message ?? "Trace request failed" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [traceId]);

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Why this advice?</h1>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Governance view — shows memory IDs and strategy signals used for the response.
          </div>

          {traceId ? (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              Viewing trace id …{traceId.slice(-6)}
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              No trace id provided.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => (window.location.href = "/")}>Back</button>
          <button onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {!data ? (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            No data yet.
          </div>
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
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                Trace id …{data.trace.id.slice(-6)} · Captured:{" "}
                <strong>{fmt(data.trace.created_at)}</strong> · Used memories:{" "}
                <strong>{data.trace.picked_memory_ids.length}</strong>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                  <strong>User</strong>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{data.trace.query_text}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                  <strong>Memori</strong>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{data.trace.assistant_text}</div>
              </div>
            </div>

            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                <strong>Memories used</strong> (IDs)
              </div>

              {data.trace.picked_memory_ids.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No memories used for this response.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {data.trace.picked_memory_ids.map((id) => (
                    <div
                      key={id}
                      style={{ padding: 10, border: "1px solid #eee", borderRadius: 8 }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.75 }}>id …{id.slice(-6)}</div>
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                        Full id: {id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                <strong>Strategy history</strong> (raw)
              </div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, opacity: 0.85 }}>
                {JSON.stringify(data.trace.strategy_history ?? [], null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}