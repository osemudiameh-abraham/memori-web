"use client";

import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const StarLogo = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
    <path d="M50 5C50 5 54 35 70 50C54 65 50 95 50 95C50 95 46 65 30 50C46 35 50 5 50 5Z" fill="#1558D6"/>
    <path d="M5 50C5 50 35 46 50 30C65 46 95 50 95 50C95 50 65 54 50 70C35 54 5 50 5 50Z" fill="#4285F4"/>
  </svg>
);

const HamburgerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const NewChatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const VaultIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 9V7M12 17v-2M9 12H7M17 12h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ReviewsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TraceIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DigestIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

interface AppShellProps {
  children: React.ReactNode;
  reviewBadge?: number;
}

export default function AppShell({ children, reviewBadge = 0 }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [avatarLetter, setAvatarLetter] = useState("U");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.email || "U";
      setAvatarLetter(name.charAt(0).toUpperCase());
    });
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems: NavItem[] = [
    { href: "/vault", icon: <VaultIcon />, label: "Vault" },
    { href: "/reviews", icon: <ReviewsIcon />, label: "Reviews", badge: reviewBadge },
    { href: "/trace", icon: <TraceIcon />, label: "Trace" },
    { href: "/digest", icon: <DigestIcon />, label: "Digest" },
  ];

  const isActive = (href: string) => pathname === href || (href === "/" && pathname === "/");

  const sidebarIconBtn = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: "50%",
    color: "var(--text-secondary)",
    transition: "background var(--transition)",
    cursor: "pointer",
    border: "none",
    background: "none",
    position: "relative" as const,
    flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Desktop Sidebar */}
      <aside
        style={{
          width: expanded ? 220 : 72,
          minWidth: expanded ? 220 : 72,
          background: "var(--sidebar-bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: expanded ? "flex-start" : "center",
          padding: "12px 0",
          transition: "width var(--transition), min-width var(--transition)",
          overflow: "hidden",
          flexShrink: 0,
          zIndex: 10,
        }}
        className="hidden md:flex"
      >
        {/* Top: hamburger + new chat */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: expanded ? "flex-start" : "center", width: "100%", padding: expanded ? "0 12px" : "0", gap: 4, marginBottom: 16 }}>
          <button
            style={sidebarIconBtn}
            onClick={() => setExpanded(e => !e)}
            title="Menu"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <HamburgerIcon />
              {expanded && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Menu</span>}
            </span>
          </button>
          <button
            style={{ ...sidebarIconBtn, borderRadius: 16 }}
            onClick={() => router.push("/")}
            title="New chat"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <NewChatIcon />
              {expanded && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>New chat</span>}
            </span>
          </button>
        </div>

        {/* Middle nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: expanded ? "flex-start" : "center", width: "100%", padding: expanded ? "0 12px" : "0", gap: 2 }}>
          {navItems.map((item) => (
            <button
              key={item.href}
              style={{
                ...sidebarIconBtn,
                borderRadius: expanded ? 12 : "50%",
                width: expanded ? "100%" : 48,
                justifyContent: expanded ? "flex-start" : "center",
                padding: expanded ? "0 12px" : 0,
                background: isActive(item.href) ? "#C2D9FF" : "none",
                color: isActive(item.href) ? "#0B57D0" : "var(--text-secondary)",
              }}
              onClick={() => router.push(item.href)}
              title={item.label}
              onMouseEnter={e => { if (!isActive(item.href)) (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.08)"; }}
              onMouseLeave={e => { if (!isActive(item.href)) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                {item.icon}
                {(item.badge ?? 0) > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -4, right: expanded ? "auto" : -4,
                    left: expanded ? "auto" : "auto",
                    background: "var(--blue)",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 16, height: 16,
                    fontSize: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 600,
                  }}>{item.badge}</span>
                )}
                {expanded && <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap" }}>{item.label}</span>}
                {expanded && (item.badge ?? 0) > 0 && (
                  <span style={{
                    marginLeft: "auto",
                    background: "var(--blue)",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "1px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                  }}>{item.badge}</span>
                )}
              </span>
            </button>
          ))}
        </nav>

        {/* Bottom: settings + avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: expanded ? "flex-start" : "center", width: "100%", padding: expanded ? "0 12px" : "0", gap: 2, paddingBottom: 8 }}>
          <button
            style={{
              ...sidebarIconBtn,
              borderRadius: expanded ? 12 : "50%",
              width: expanded ? "100%" : 48,
              justifyContent: expanded ? "flex-start" : "center",
              padding: expanded ? "0 12px" : 0,
              background: isActive("/settings") ? "#C2D9FF" : "none",
              color: isActive("/settings") ? "#0B57D0" : "var(--text-secondary)",
            }}
            onClick={() => router.push("/settings")}
            title="Settings"
            onMouseEnter={e => { if (!isActive("/settings")) (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { if (!isActive("/settings")) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SettingsIcon />
              {expanded && <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap" }}>Settings</span>}
            </span>
          </button>
          <button
            style={{ ...sidebarIconBtn, borderRadius: "50%" }}
            onClick={handleSignOut}
            title="Sign out"
          >
            <span style={{
              width: 32, height: 32,
              borderRadius: "50%",
              background: "var(--blue)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 600,
            }}>
              {avatarLetter}
            </span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--bg)",
            flexShrink: 0,
          }}
          className="flex md:hidden"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StarLogo />
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Seven</span>
          </div>
          <button onClick={handleSignOut} style={{ cursor: "pointer" }}>
            <span style={{
              width: 32, height: 32,
              borderRadius: "50%",
              background: "var(--blue)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 600,
            }}>
              {avatarLetter}
            </span>
          </button>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {children}
        </div>

        {/* Mobile bottom tab bar */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            background: "var(--surface)",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            padding: "8px 0 12px",
            flexShrink: 0,
          }}
          className="flex md:hidden"
        >
          {[
            { href: "/", icon: <HomeIcon />, label: "Home" },
            { href: "/reviews", icon: <ReviewsIcon />, label: "Reviews", badge: reviewBadge },
            { href: "/vault", icon: <VaultIcon />, label: "Vault" },
            { href: "/settings", icon: <SettingsIcon />, label: "Settings" },
          ].map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                color: isActive(item.href) ? "#0B57D0" : "var(--text-secondary)",
                padding: "4px 12px",
                borderRadius: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                position: "relative",
              }}
            >
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
              {(item.badge ?? 0) > 0 && (
                <span style={{
                  position: "absolute",
                  top: 0, right: 8,
                  background: "var(--blue)",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 14, height: 14,
                  fontSize: 9,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 600,
                }}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
