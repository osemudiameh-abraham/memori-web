"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

interface DigestSection {
  title: string;
  items: string[];
}

interface DigestData {
  week?: string;
  sections?: DigestSection[];
  summary?: string;
  learned?: string[];
  decisions?: string[];
  patterns?: string[];
}

export default function DigestPage() {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/digest/weekly", { credentials: "include" });
        if (res.ok) setDigest(await res.json() as DigestData);
      } catch {}
      setLoading(false);
    })();
  }, []);

  // Normalise into sections
  const sections: DigestSection[] = digest?.sections ?? [
    ...(digest?.learned?.length ? [{ title: "What Seven learned this week", items: digest.learned }] : []),
    ...(digest?.decisions?.length ? [{ title: "Decisions captured", items: digest.decisions }] : []),
    ...(digest?.patterns?.length ? [{ title: "Patterns spotted", items: digest.patterns }] : []),
  ];

  const SECTION_ICONS: Record<string, string> = {
    "What Seven learned this week": "🧠",
    "Decisions captured": "🎯",
    "Patterns spotted": "⚡",
  };

  return (
    <AppShell>
      <div style={{ flex: 1, padding: "40px 32px", maxWidth: 680, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            Weekly Digest
          </h1>
          {digest?.week && (
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Week of {digest.week}
            </p>
          )}
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
        ) : !digest || sections.length === 0 ? (
          <div style={{
            background: "var(--surface)", borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)", padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
              No digest yet
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Keep chatting with Seven. Your weekly digest will appear here every Sunday.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Summary card */}
            {digest.summary && (
              <div style={{
                background: "var(--blue-light)",
                borderRadius: "var(--radius-card)",
                padding: "24px",
                borderLeft: "4px solid var(--blue)",
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  This week in summary
                </p>
                <p style={{ fontSize: 15, color: "var(--text-primary)", lineHeight: 1.65 }}>
                  {digest.summary}
                </p>
              </div>
            )}

            {sections.map((section, i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--radius-card)",
                  boxShadow: "var(--shadow-card)",
                  padding: "24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 20 }}>{SECTION_ICONS[section.title] ?? "📌"}</span>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{section.title}</h2>
                </div>
                <ul style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
                  {section.items.map((item, j) => (
                    <li key={j} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "var(--blue)", flexShrink: 0, marginTop: 7,
                      }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}
