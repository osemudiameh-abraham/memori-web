"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

interface Fact {
  id: string;
  fact_key: string;
  subject: string;
  attribute: string;
  value_text: string;
  canonical_text: string;
  status: string;
  category?: string;
}

interface IdentitySummary {
  name?: string;
  firstName?: string;
  summary?: string;
  role?: string;
  company?: string;
  city?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  work: "💼",
  personal: "👤",
  relationships: "🤝",
  decisions: "🎯",
  default: "🧠",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:     { bg: "rgba(52,168,83,0.1)",  color: "var(--green)" },
  disputed:   { bg: "rgba(251,188,4,0.1)",  color: "#a06000" },
  historical: { bg: "rgba(66,133,244,0.1)", color: "var(--blue)" },
  superseded: { bg: "rgba(234,67,53,0.1)",  color: "var(--red)" },
};

function groupByCategory(facts: Fact[]): Record<string, Fact[]> {
  const groups: Record<string, Fact[]> = {};
  for (const f of facts) {
    const cat = f.category ?? inferCategory(f);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  }
  return groups;
}

function inferCategory(f: Fact): string {
  const key = (f.fact_key ?? "").toLowerCase();
  const attr = (f.attribute ?? "").toLowerCase();
  if (key.includes("work") || attr.includes("role") || attr.includes("company") || attr.includes("job")) return "work";
  if (key.includes("person") || attr.includes("name") || attr.includes("city") || attr.includes("age")) return "personal";
  if (key.includes("relation") || attr.includes("friend") || attr.includes("partner")) return "relationships";
  if (key.includes("decision")) return "decisions";
  return "personal";
}

export default function VaultPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [identity, setIdentity] = useState<IdentitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [idRes, factsRes] = await Promise.all([
          fetch("/api/identity-summary", { credentials: "include" }),
          fetch("/api/vault/facts", { credentials: "include" }),
        ]);
        if (idRes.ok) setIdentity(await idRes.json() as IdentitySummary);
        if (factsRes.ok) {
          const d = await factsRes.json() as { facts?: Fact[] };
          setFacts(d.facts ?? []);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const filtered = facts.filter(f =>
    search === "" ||
    f.canonical_text?.toLowerCase().includes(search.toLowerCase()) ||
    f.attribute?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = groupByCategory(filtered);
  const categories = Object.keys(grouped).sort();

  return (
    <AppShell>
      <div style={{ flex: 1, padding: "40px 32px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            Memory Vault
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Everything Seven knows about you.
          </p>
        </div>

        {/* Identity summary card */}
        {identity && (
          <div style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: "24px",
            marginBottom: 28,
            display: "flex", gap: 16, alignItems: "flex-start",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "var(--blue)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 600, flexShrink: 0,
            }}>
              {(identity.firstName ?? identity.name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {identity.firstName ?? identity.name ?? "You"}
              </p>
              {(identity.role || identity.company) && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
                  {[identity.role, identity.company].filter(Boolean).join(" · ")}
                </p>
              )}
              {identity.summary && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {identity.summary}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: 24, position: "relative" }}>
          <input
            type="text"
            placeholder="Search your memories…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: "var(--radius-pill)",
              padding: "11px 18px",
              fontSize: 14, color: "var(--text-primary)",
              outline: "none", background: "var(--surface)",
              transition: "border-color var(--transition)",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--blue)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)")}
          />
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
        ) : filtered.length === 0 ? (
          <div style={{
            background: "var(--surface)", borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)", padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
              {search ? "No matches found" : "Vault is empty"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {search ? "Try a different search term." : "Start chatting with Seven and your memories will appear here."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {categories.map(cat => (
              <div key={cat}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.default}</span>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{cat}</h2>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(0,0,0,0.06)", borderRadius: "var(--radius-pill)", padding: "2px 8px" }}>
                    {grouped[cat].length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {grouped[cat].map(fact => {
                    const sc = STATUS_COLORS[fact.status] ?? STATUS_COLORS.active;
                    return (
                      <div key={fact.id} style={{
                        background: "var(--surface)",
                        borderRadius: 14,
                        boxShadow: "0 1px 3px rgba(60,64,67,0.1)",
                        padding: "14px 16px",
                        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                      }}>
                        <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, flex: 1 }}>
                          {fact.canonical_text}
                        </p>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          background: sc.bg, color: sc.color,
                          borderRadius: "var(--radius-pill)",
                          padding: "3px 10px", flexShrink: 0, textTransform: "capitalize",
                        }}>
                          {fact.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}
