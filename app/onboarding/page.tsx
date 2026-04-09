"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const StarLogo = () => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
    <path d="M50 5C50 5 54 35 70 50C54 65 50 95 50 95C50 95 46 65 30 50C46 35 50 5 50 5Z" fill="#1558D6"/>
    <path d="M5 50C5 50 35 46 50 30C65 46 95 50 95 50C95 50 65 54 50 70C35 54 5 50 5 50Z" fill="#4285F4"/>
  </svg>
);

const TOTAL_STEPS = 6;

const FEATURES = [
  { icon: "🧠", title: "Flawless memory", desc: "Seven remembers everything you share — across every session, forever." },
  { icon: "🔍", title: "Pattern recognition", desc: "Spot recurring themes in your decisions and habits over time." },
  { icon: "🛡️", title: "Governed intelligence", desc: "Full trace of how Seven uses your information. You're always in control." },
];

const TRUST_PILLS = ["Private by design", "No ads", "You own your data", "Delete anytime"];

interface StepConfig {
  title: string;
  subtitle: string;
  field: string;
  placeholder: string;
  type?: string;
}

const STEP_CONFIGS: StepConfig[] = [
  { title: "What's your first name?", subtitle: "So Seven can greet you properly.", field: "firstName", placeholder: "Your first name" },
  { title: "What do you do?", subtitle: "Your role helps Seven give more relevant insights.", field: "role", placeholder: "e.g. Product manager, Founder, Engineer…" },
  { title: "Where do you work?", subtitle: "Optional — helps with context.", field: "company", placeholder: "Company or organisation" },
  { title: "What city are you in?", subtitle: "Optional — for time-zone aware reminders.", field: "city", placeholder: "e.g. London, New York, Lagos…" },
  { title: "What are your main goals?", subtitle: "What do you want Seven to help you with most?", field: "goals", placeholder: "e.g. Make better decisions, remember important things, track my progress…", type: "textarea" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = welcome, 1-5 = data collection, 6 = done
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setField = (key: string, val: string) => setValues(v => ({ ...v, [key]: val }));

  const handleContinue = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      // Submit onboarding
      setBusy(true); setError("");
      try {
        const parts: string[] = [];
        if (values.firstName) parts.push(`My name is ${values.firstName}.`);
        if (values.role) parts.push(`I work as ${values.role}.`);
        if (values.company) parts.push(`I work at ${values.company}.`);
        if (values.city) parts.push(`I am based in ${values.city}.`);
        if (values.goals) parts.push(`My goals: ${values.goals}`);
        if (parts.length > 0) {
          await fetch("/api/chat", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: parts.join(" ") }),
          });
        }
        router.push("/");
      } catch {
        setError("Something went wrong. Please try again.");
        setBusy(false);
      }
    }
  };

  const progress = step / (TOTAL_STEPS - 1);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "var(--font)",
    }}>
      <div style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        width: "100%",
        maxWidth: 520,
        overflow: "hidden",
      }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: "rgba(0,0,0,0.06)", position: "relative" }}>
          <div style={{
            height: "100%",
            background: "var(--blue)",
            width: `${progress * 100}%`,
            transition: "width 0.4s ease",
            borderRadius: "0 4px 4px 0",
          }} />
        </div>

        <div style={{ padding: "40px 40px 48px" }}>
          {/* Step counter */}
          <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 28, letterSpacing: "0.04em" }}>
            Step {step + 1} of {TOTAL_STEPS}
          </p>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <StarLogo />
              <div style={{ height: 20 }} />
              <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}>
                Meet Seven
              </h1>
              <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 36, lineHeight: 1.6, maxWidth: 360 }}>
                The AI that actually knows you — and never forgets.
              </p>

              {/* Feature rows */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
                {FEATURES.map(f => (
                  <div key={f.title} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    background: "var(--bg)", borderRadius: 14, padding: "14px 16px",
                    border: "1px solid rgba(0,0,0,0.06)", textAlign: "left",
                  }}>
                    <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{f.icon}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{f.title}</p>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 32 }}>
                {TRUST_PILLS.map(pill => (
                  <span key={pill} style={{
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: "var(--radius-pill)",
                    padding: "5px 14px",
                    fontSize: 12, color: "var(--text-secondary)",
                    background: "var(--bg)",
                  }}>
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Steps 1-5: data collection */}
          {step >= 1 && step <= 5 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
                {STEP_CONFIGS[step - 1].title}
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 28 }}>
                {STEP_CONFIGS[step - 1].subtitle}
              </p>
              {STEP_CONFIGS[step - 1].type === "textarea" ? (
                <textarea
                  value={values[STEP_CONFIGS[step - 1].field] ?? ""}
                  onChange={e => setField(STEP_CONFIGS[step - 1].field, e.target.value)}
                  placeholder={STEP_CONFIGS[step - 1].placeholder}
                  rows={4}
                  style={{
                    width: "100%",
                    border: "1px solid rgba(0,0,0,0.15)",
                    borderRadius: 14,
                    padding: "14px 16px",
                    fontSize: 15, color: "var(--text-primary)",
                    outline: "none", resize: "vertical",
                    background: "var(--surface)",
                    lineHeight: 1.6,
                    marginBottom: 24,
                    transition: "border-color var(--transition)",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--blue)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)")}
                />
              ) : (
                <input
                  type="text"
                  value={values[STEP_CONFIGS[step - 1].field] ?? ""}
                  onChange={e => setField(STEP_CONFIGS[step - 1].field, e.target.value)}
                  placeholder={STEP_CONFIGS[step - 1].placeholder}
                  onKeyDown={e => { if (e.key === "Enter") handleContinue(); }}
                  style={{
                    width: "100%",
                    border: "1px solid rgba(0,0,0,0.15)",
                    borderRadius: "var(--radius-pill)",
                    padding: "14px 20px",
                    fontSize: 15, color: "var(--text-primary)",
                    outline: "none",
                    background: "var(--surface)",
                    marginBottom: 24,
                    transition: "border-color var(--transition)",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--blue)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)")}
                  autoFocus
                />
              )}
            </div>
          )}

          {error && <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 16 }}>{error}</p>}

          {/* Continue button */}
          <button
            onClick={handleContinue}
            disabled={busy}
            style={{
              width: "100%",
              background: "var(--blue)",
              color: "#fff",
              borderRadius: "var(--radius-pill)",
              padding: "14px 20px",
              fontSize: 15, fontWeight: 500,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
              transition: "opacity var(--transition)",
            }}
          >
            {busy ? "Setting up…" : step === TOTAL_STEPS - 1 ? "Get started" : "Continue"}
          </button>

          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                width: "100%", marginTop: 12,
                background: "none",
                color: "var(--text-muted)",
                borderRadius: "var(--radius-pill)",
                padding: "10px 20px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
