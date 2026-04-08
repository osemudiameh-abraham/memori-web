"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Prefs = {
  timezone: string;
  email_reminders: boolean;
  push_enabled: boolean;
  reminder_time: string;
};

type Section = "notifications" | "privacy" | "data" | "account";

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      aria-label={on ? "Disable" : "Enable"}
      style={{
        width:44, height:25, borderRadius:13, border:"none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: on ? "linear-gradient(135deg,#5BA8D8,#80C4EC)" : "rgba(0,0,0,0.14)",
        position:"relative", flexShrink:0, transition:"background 200ms ease",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position:"absolute", top:3,
        left: on ? 22 : 3,
        width:19, height:19, borderRadius:"50%",
        background:"white", boxShadow:"0 1px 3px rgba(0,0,0,0.20)",
        transition:"left 200ms ease",
      }}/>
    </button>
  );
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, padding:"14px 0", borderBottom:"1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14.5, fontWeight:500, color:"#1C1A18", marginBottom: sub ? 2 : 0 }}>{label}</div>
        {sub && <div style={{ fontSize:13, color:"#8A8785", lineHeight:1.50 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}>{children}</div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.90)", border:"1px solid rgba(0,0,0,0.08)", borderRadius:16, padding:"20px 22px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)", marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:16, fontWeight:500, color:"#2A2825" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>({ timezone:"Europe/London", email_reminders:true, push_enabled:false, reminder_time:"08:00" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("notifications");

  useEffect(() => {
    async function init() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);

      try {
        const res = await fetch("/api/preferences", { credentials:"include" });
        const data2 = await res.json();
        if (res.ok && data2.ok) {
          setPrefs({
            timezone: data2.preferences.timezone ?? "Europe/London",
            email_reminders: data2.preferences.email_reminders ?? true,
            push_enabled: data2.preferences.push_enabled ?? false,
            reminder_time: (data2.preferences.reminder_time ?? "08:00:00").slice(0, 5),
          });
        }
      } catch {}
      setLoading(false);
    }
    void init();
  }, []);

  async function savePrefs() {
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/preferences", {
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...prefs, reminder_time: prefs.reminder_time + ":00" }),
      });
      const data = await res.json();
      setSaveMsg(res.ok && data.ok ? "Saved." : data.error ?? "Failed to save.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch { setSaveMsg("Failed to save."); }
    finally { setSaving(false); }
  }

  async function exportData() {
    setExporting(true);
    try {
      const [factsRes, entitiesRes] = await Promise.all([
        fetch("/api/facts?include_evidence=0", { credentials:"include" }).then(r => r.json()),
        fetch("/api/entities", { credentials:"include" }).then(r => r.json()),
      ]);
      const exportData = {
        exported_at: new Date().toISOString(),
        facts: factsRes.ok ? factsRes.facts : [],
        entities: entitiesRes.ok ? entitiesRes.entities : [],
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `memori-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 4000);
    } catch {}
    finally { setExporting(false); }
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id:"notifications", label:"Notifications", icon:"🔔" },
    { id:"privacy",       label:"Privacy",       icon:"🔒" },
    { id:"data",          label:"Your data",     icon:"📤" },
    { id:"account",       label:"Account",       icon:"👤" },
  ];

  const navBtnStyle = (active: boolean): React.CSSProperties => ({
    display:"flex", alignItems:"center", gap:9,
    padding:"9px 12px", borderRadius:10, border:"none",
    cursor:"pointer", width:"100%", textAlign:"left",
    fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight: active ? 500 : 400,
    background: active ? "rgba(0,0,0,0.07)" : "transparent",
    color: active ? "#1C1A18" : "#6B6865",
    transition:"all 120ms ease",
  });

  const inp: React.CSSProperties = {
    padding:"9px 12px", borderRadius:9, border:"1.5px solid rgba(0,0,0,0.12)",
    background:"rgba(255,255,255,0.85)", fontFamily:"'DM Sans',sans-serif",
    fontSize:14, color:"#1C1A18", outline:"none",
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}html,body{height:100%;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#FAF9F5;color:#1C1A18;}`}</style>
      <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse 80% 60% at 50% -10%,rgba(255,255,255,0.98) 0%,transparent 60%),#F5F4F0" }}>

        {/* Topbar */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"16px 24px", borderBottom:"1px solid rgba(0,0,0,0.07)", background:"rgba(245,244,240,0.80)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10 }}>
          <a href="/" style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)", color:"#3C3A38", fontSize:13.5, textDecoration:"none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Home
          </a>
          <span style={{ fontFamily:"'Lora',Georgia,serif", fontSize:17, fontWeight:500, color:"#2A2825" }}>Settings</span>
        </div>

        <div style={{ maxWidth:820, margin:"0 auto", padding:"32px 24px 80px", display:"grid", gridTemplateColumns:"200px 1fr", gap:24, alignItems:"start" }}>

          {/* Sidebar nav */}
          <div style={{ position:"sticky", top:80 }}>
            <div style={{ background:"rgba(255,255,255,0.80)", border:"1px solid rgba(0,0,0,0.08)", borderRadius:14, padding:8, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
              {navItems.map(({ id, label, icon }) => (
                <button key={id} style={navBtnStyle(activeSection === id)} onClick={() => setActiveSection(id)}>
                  <span style={{ fontSize:15 }}>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            {loading ? (
              <div style={{ textAlign:"center", padding:48, color:"#8A8785", fontSize:14 }}>Loading…</div>
            ) : (
              <>
                {/* Notifications */}
                {activeSection === "notifications" && (
                  <SectionCard title="Notifications" icon="🔔">
                    <SettingRow label="Email reminders" sub="Get notified by email when decisions are due for review">
                      <Toggle on={prefs.email_reminders} onChange={v => setPrefs(p => ({ ...p, email_reminders: v }))}/>
                    </SettingRow>
                    <SettingRow label="Push notifications" sub="Browser push notifications for due reminders">
                      <Toggle on={prefs.push_enabled} onChange={v => setPrefs(p => ({ ...p, push_enabled: v }))}/>
                    </SettingRow>
                    <SettingRow label="Reminder time" sub="What time of day should Seven send reminders?">
                      <input type="time" value={prefs.reminder_time} onChange={e => setPrefs(p => ({ ...p, reminder_time: e.target.value }))} style={{ ...inp, width:120 }}/>
                    </SettingRow>
                    <SettingRow label="Timezone" sub="Used to calculate correct reminder delivery time">
                      <input type="text" value={prefs.timezone} onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))} placeholder="Europe/London" style={{ ...inp, width:170 }}/>
                    </SettingRow>
                    <div style={{ marginTop:16, display:"flex", alignItems:"center", gap:12 }}>
                      <button onClick={() => void savePrefs()} disabled={saving} style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"#1C1A18", color:"#FAF9F5", fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:500, cursor:"pointer", opacity:saving?0.6:1 }}>
                        {saving ? "Saving…" : "Save preferences"}
                      </button>
                      {saveMsg && <span style={{ fontSize:13.5, color: saveMsg === "Saved." ? "#1A5C32" : "#6A1A1A" }}>{saveMsg}</span>}
                    </div>
                  </SectionCard>
                )}

                {/* Privacy */}
                {activeSection === "privacy" && (
                  <SectionCard title="Privacy" icon="🔒">
                    <SettingRow label="End-to-end encryption" sub="All your memories are encrypted at rest and in transit using AES-256">
                      <span style={{ fontSize:12, fontWeight:600, color:"#1A5C32", background:"rgba(20,140,60,0.10)", padding:"3px 10px", borderRadius:100 }}>Active</span>
                    </SettingRow>
                    <SettingRow label="Data training" sub="Your conversations and memories are never used to train AI models">
                      <span style={{ fontSize:12, fontWeight:600, color:"#1A5C32", background:"rgba(20,140,60,0.10)", padding:"3px 10px", borderRadius:100 }}>Never</span>
                    </SettingRow>
                    <SettingRow label="Third-party sharing" sub="Your data is never sold or shared with advertisers or data brokers">
                      <span style={{ fontSize:12, fontWeight:600, color:"#1A5C32", background:"rgba(20,140,60,0.10)", padding:"3px 10px", borderRadius:100 }}>Never</span>
                    </SettingRow>
                    <SettingRow label="Governance audit" sub="Full trace of every response — see exactly what Seven used to answer">
                      <a href="/trace" style={{ fontSize:13.5, color:"#3A3835", textDecoration:"none", padding:"6px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)" }}>View trace →</a>
                    </SettingRow>
                    <SettingRow label="Facts audit" sub="View, correct, or dispute any fact Seven has stored about you">
                      <a href="/facts" style={{ fontSize:13.5, color:"#3A3835", textDecoration:"none", padding:"6px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)" }}>View facts →</a>
                    </SettingRow>
                  </SectionCard>
                )}

                {/* Data */}
                {activeSection === "data" && (
                  <SectionCard title="Your data" icon="📤">
                    <p style={{ fontSize:14, color:"#6B6865", lineHeight:1.60, marginBottom:20 }}>You own everything stored about you. Export it at any time in machine-readable JSON format.</p>
                    <SettingRow label="Export your data" sub="Download all your facts, entities, and decisions as a JSON file">
                      <button onClick={() => void exportData()} disabled={exporting} style={{ padding:"8px 16px", borderRadius:10, border:"1px solid rgba(0,0,0,0.14)", background:"rgba(255,255,255,0.80)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, cursor:"pointer", color:"#1C1A18" }}>
                        {exporting ? "Preparing…" : exportDone ? "✓ Downloaded" : "Export JSON"}
                      </button>
                    </SettingRow>
                    <SettingRow label="Memory vault" sub="View, correct, or delete individual memories">
                      <a href="/vault" style={{ fontSize:13.5, color:"#3A3835", textDecoration:"none", padding:"6px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)" }}>Open vault →</a>
                    </SettingRow>
                    <SettingRow label="Decision ledger" sub="Review all decisions and outcomes Seven has recorded">
                      <a href="/reviews" style={{ fontSize:13.5, color:"#3A3835", textDecoration:"none", padding:"6px 12px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.70)" }}>Open ledger →</a>
                    </SettingRow>
                  </SectionCard>
                )}

                {/* Account */}
                {activeSection === "account" && (
                  <>
                    <SectionCard title="Account" icon="👤">
                      <SettingRow label="Email address" sub="Your Seven account email">
                        <span style={{ fontSize:14, color:"#4A4845" }}>{email ?? "—"}</span>
                      </SettingRow>
                      <SettingRow label="Gmail" sub="Connect Gmail to send emails directly from your account">
                        <a href="/api/auth/gmail" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, background:"#1C1A18", color:"#FAF9F5", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, fontWeight:500, textDecoration:"none" }}>
                          Connect →
                        </a>
                      </SettingRow>

                      <SettingRow label="Sign out" sub="Sign out of Seven on this device">
                        <button onClick={() => void signOut()} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid rgba(0,0,0,0.14)", background:"rgba(255,255,255,0.80)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, cursor:"pointer", color:"#3C3A38" }}>
                          Sign out
                        </button>
                      </SettingRow>
                    </SectionCard>

                    <SectionCard title="Danger zone" icon="⚠️">
                      <p style={{ fontSize:13.5, color:"#8A8785", lineHeight:1.58, marginBottom:16 }}>These actions are irreversible. Please be certain before proceeding.</p>
                      {!deleteConfirm ? (
                        <SettingRow label="Delete account" sub="Permanently delete your account, all memories, and all data. This cannot be undone.">
                          <button onClick={() => setDeleteConfirm(true)} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid rgba(185,60,60,0.30)", background:"rgba(255,240,240,0.80)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, cursor:"pointer", color:"#8B1A1A" }}>
                            Delete account
                          </button>
                        </SettingRow>
                      ) : (
                        <div style={{ padding:"16px", borderRadius:12, background:"rgba(255,240,240,0.90)", border:"1px solid rgba(185,60,60,0.20)" }}>
                          <div style={{ fontSize:14, fontWeight:500, color:"#6A1A1A", marginBottom:8 }}>Are you absolutely sure?</div>
                          <div style={{ fontSize:13, color:"#8B1A1A", marginBottom:14, lineHeight:1.55 }}>This will permanently delete your account and all associated data. This cannot be undone.</div>
                          <div style={{ display:"flex", gap:8 }}>
                            <button onClick={() => setDeleteConfirm(false)} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid rgba(0,0,0,0.12)", background:"rgba(255,255,255,0.80)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, cursor:"pointer", color:"#3C3A38" }}>
                              Cancel
                            </button>
                            <button style={{ padding:"7px 14px", borderRadius:9, border:"none", background:"#8B1A1A", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, cursor:"pointer", color:"white" }}>
                              Yes, delete everything
                            </button>
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
