"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";

interface Prefs {
  timezone?: string;
  email_reminders?: boolean;
  push_enabled?: boolean;
  reminder_time?: string;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: on ? "var(--blue)" : "rgba(0,0,0,0.15)",
        position: "relative", transition: "background var(--transition)",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: "#fff", transition: "left var(--transition)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 13, fontWeight: 600,
        color: "var(--text-muted)", textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 12,
      }}>
        {title}
      </h2>
      <div style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, desc, right }: { label: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 20px", gap: 16,
      borderBottom: "1px solid rgba(0,0,0,0.06)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: desc ? 2 : 0 }}>
          {label}
        </p>
        {desc && <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{desc}</p>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [prefs, setPrefs] = useState<Prefs>({ email_reminders: true, push_enabled: false });
  const [email, setEmail] = useState("");
  const [gmailStatus, setGmailStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [userRes, prefsRes, gmailRes] = await Promise.all([
          supabase.auth.getUser(),
          fetch("/api/settings", { credentials: "include" }),
          fetch("/api/auth/gmail", { credentials: "include" }).catch(() => null),
        ]);
        setEmail(userRes.data.user?.email ?? "");
        if (prefsRes.ok) setPrefs(await prefsRes.json() as Prefs);
        if (gmailRes?.ok) {
          const d = await gmailRes.json() as { connected?: boolean };
          setGmailStatus(d.connected ? "connected" : "disconnected");
        }
      } catch {}
    })();
  }, [supabase]);

  const savePrefs = async (next: Prefs) => {
    setPrefs(next);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {}
    setSaving(false);
  };

  const handleGmailConnect = async () => {
    try {
      const res = await fetch("/api/auth/gmail", { method: "POST", credentials: "include" });
      if (res.ok) {
        const d = await res.json() as { url?: string };
        if (d.url) window.location.href = d.url;
      }
    } catch {}
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/settings/export", { credentials: "include" });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "seven-data-export.json";
        a.click(); URL.revokeObjectURL(url);
      }
    } catch {}
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    try {
      await fetch("/api/settings/delete-account", { method: "DELETE", credentials: "include" });
      await supabase.auth.signOut();
      router.push("/login");
    } catch {}
  };

  return (
    <AppShell>
      <div style={{ flex: 1, padding: "40px 32px", maxWidth: 640, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>Settings</h1>
          {saving && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Saving…</p>}
        </div>

        {/* Account */}
        <Section title="Account">
          <Row
            label="Email address"
            desc={email || "Not signed in"}
          />
          <Row
            label="Sign out"
            right={
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
                style={{
                  background: "rgba(0,0,0,0.06)", color: "var(--text-secondary)",
                  borderRadius: "var(--radius-pill)", padding: "8px 16px",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                Sign out
              </button>
            }
          />
        </Section>

        {/* Gmail */}
        <Section title="Gmail Connection">
          <Row
            label="Connect Gmail"
            desc={
              gmailStatus === "connected"
                ? "Gmail is connected. Seven can draft emails on your behalf."
                : "Connect Gmail to let Seven draft emails for you."
            }
            right={
              gmailStatus === "connected" ? (
                <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 500 }}>✓ Connected</span>
              ) : (
                <button
                  onClick={handleGmailConnect}
                  style={{
                    background: "var(--blue)", color: "#fff",
                    borderRadius: "var(--radius-pill)", padding: "8px 16px",
                    fontSize: 13, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  Connect
                </button>
              )
            }
          />
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Row
            label="Email reminders"
            desc="Weekly digest and decision review reminders by email."
            right={
              <Toggle
                on={prefs.email_reminders ?? true}
                onChange={v => savePrefs({ ...prefs, email_reminders: v })}
              />
            }
          />
          <Row
            label="Push notifications"
            desc="In-app notifications when reviews are due."
            right={
              <Toggle
                on={prefs.push_enabled ?? false}
                onChange={v => savePrefs({ ...prefs, push_enabled: v })}
              />
            }
          />
          <Row
            label="Reminder time"
            desc="What time of day should Seven send reminders?"
            right={
              <input
                type="time"
                value={prefs.reminder_time ?? "09:00"}
                onChange={e => savePrefs({ ...prefs, reminder_time: e.target.value })}
                style={{
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: 8, padding: "6px 10px",
                  fontSize: 13, color: "var(--text-primary)",
                  outline: "none", background: "var(--surface)",
                }}
              />
            }
          />
        </Section>

        {/* Data */}
        <Section title="Data">
          <Row
            label="Export your data"
            desc="Download all your memories and decisions as JSON."
            right={
              <button
                onClick={handleExport}
                style={{
                  background: "rgba(0,0,0,0.06)", color: "var(--text-secondary)",
                  borderRadius: "var(--radius-pill)", padding: "8px 16px",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                Export
              </button>
            }
          />
        </Section>

        {/* Danger zone */}
        <Section title="Danger Zone">
          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--red)", marginBottom: 8 }}>
              Delete account
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
              This permanently deletes your account, all memories, and all data. This cannot be undone.
            </p>
            {deleteConfirm && (
              <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12, fontWeight: 500 }}>
                Are you sure? Click again to confirm. This is permanent.
              </p>
            )}
            <button
              onClick={handleDeleteAccount}
              style={{
                background: deleteConfirm ? "var(--red)" : "rgba(234,67,53,0.1)",
                color: deleteConfirm ? "#fff" : "var(--red)",
                borderRadius: "var(--radius-pill)", padding: "10px 20px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "background var(--transition), color var(--transition)",
              }}
            >
              {deleteConfirm ? "Yes, delete my account" : "Delete my account"}
            </button>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
