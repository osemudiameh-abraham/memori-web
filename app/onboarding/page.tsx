"use client";

import { useState } from "react";

type OnboardingResponse =
  | {
      ok: true;
      stored_raw_fact_count: number;
      canonical_fact_count: number;
    }
  | {
      ok: false;
      error: string;
    };

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [relationshipLabel, setRelationshipLabel] = useState("");
  const [relationshipName, setRelationshipName] = useState("");
  const [petType, setPetType] = useState("");
  const [petName, setPetName] = useState("");
  const [currentGoal, setCurrentGoal] = useState("");
  const [importantPreference, setImportantPreference] = useState("");

  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setStatus("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          city,
          timezone,
          company,
          role,
          relationshipLabel,
          relationshipName,
          petType,
          petName,
          currentGoal,
          importantPreference,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as OnboardingResponse;

      if (!res.ok || data.ok === false) {
        setStatus(data.ok === false ? data.error : "Onboarding failed");
        return;
      }

      setStatus(
        `Saved. Raw facts: ${data.stored_raw_fact_count}. Canonical facts: ${data.canonical_fact_count}.`
      );
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 16 }}>
      <h1>Memori Onboarding</h1>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        Seed Memori with your core facts so recall works immediately.
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <label>
          <div>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          <div>City</div>
          <input value={city} onChange={(e) => setCity(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          <div>Timezone</div>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. Europe/London"
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <div>Company</div>
          <input value={company} onChange={(e) => setCompany(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          <div>Role</div>
          <input value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          <div>One important relationship label</div>
          <input
            value={relationshipLabel}
            onChange={(e) => setRelationshipLabel(e.target.value)}
            placeholder="e.g. friend, sister, partner, colleague"
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <div>That person’s name</div>
          <input
            value={relationshipName}
            onChange={(e) => setRelationshipName(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <div>Pet type</div>
          <input
            value={petType}
            onChange={(e) => setPetType(e.target.value)}
            placeholder="e.g. dog, cat"
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <div>Pet name</div>
          <input value={petName} onChange={(e) => setPetName(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          <div>Current goal</div>
          <textarea
            value={currentGoal}
            onChange={(e) => setCurrentGoal(e.target.value)}
            rows={3}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          <div>Important preference</div>
          <textarea
            value={importantPreference}
            onChange={(e) => setImportantPreference(e.target.value)}
            rows={3}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={() => void submit()} disabled={busy}>
          {busy ? "Saving..." : "Save onboarding"}
        </button>
        <button onClick={() => (window.location.href = "/")}>Back</button>
      </div>

      {status && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          {status}
        </div>
      )}
    </main>
  );
}