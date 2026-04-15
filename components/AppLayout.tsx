"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type AppLayoutAgent = {
  id: string;
  name: string;
  role: string;
  branch_id?: string | null;
} | null;

export type AppLayoutPage = "booking" | "ops" | "admin";

type LayoutTier = "mobile" | "tablet" | "desktop";

function useLayoutTier(): LayoutTier {
  const read = (): LayoutTier => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w < 768) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };
  const [tier, setTier] = useState<LayoutTier>(() =>
    typeof window !== "undefined" ? read() : "desktop"
  );
  useEffect(() => {
    const onResize = () => setTier(read());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return tier;
}

function roleFlags(role: string | undefined) {
  const r = (role ?? "").toLowerCase();
  const isAdmin = r === "admin" || r === "أدمن";
  const isOps = r === "ops";
  return { isAdmin, isOps };
}

export default function AppLayout({
  children,
  agent,
  currentPage,
}: {
  children: ReactNode;
  agent: AppLayoutAgent;
  currentPage: AppLayoutPage;
}) {
  const tier = useLayoutTier();
  const { isAdmin, isOps } = roleFlags(agent?.role);

  const navItems = [
    {
      key: "booking" as const,
      href: "/booking",
      label: "Booking",
      icon: "📅",
      show: true,
    },
    {
      key: "ops" as const,
      href: "/ops",
      label: "Operations",
      icon: "🔧",
      show: isOps || isAdmin,
    },
    {
      key: "admin" as const,
      href: "/admin",
      label: "Admin",
      icon: "⚙️",
      show: isAdmin,
    },
  ].filter((x) => x.show);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  const sidebarW = tier === "desktop" ? 220 : tier === "tablet" ? 60 : 0;
  const showSidebar = tier !== "mobile";

  const navLinkBase: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: tier === "tablet" ? "center" : "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: "var(--radius-md)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    transition: "all 0.15s",
    color: "var(--text-secondary)",
    border: "1px solid transparent",
    boxSizing: "border-box",
  };

  const navLinkActive: CSSProperties = {
    background: "rgba(191,30,46,0.10)",
    color: "var(--brand-red)",
    fontWeight: 600,
    border: "1px solid rgba(191,30,46,0.20)",
  };

  const initial = (agent?.name ?? "?").trim().charAt(0).toUpperCase() || "?";

  const roleBadgeStyle = (): CSSProperties => {
    const r = (agent?.role ?? "").toLowerCase();
    if (r === "admin" || r === "أدمن")
      return {
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        color: "var(--brand-red)",
      };
    if (r === "ops")
      return {
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        color: "#f59e0b",
      };
    return {
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      color: "var(--text-muted)",
    };
  };

  const roleLabel = (): string => {
    const r = (agent?.role ?? "").toLowerCase();
    if (r === "admin" || r === "أدمن") return "Admin";
    if (r === "ops") return "Ops";
    return "Agent";
  };

  return (
    <div
      className="app-shell"
      style={{
        display: "flex",
        minHeight: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      {showSidebar && (
        <aside
          style={{
            width: sidebarW,
            background: "var(--surface-card)",
            borderRight: "1px solid var(--border-subtle)",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            left: 0,
            top: 0,
            zIndex: 40,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: tier === "tablet" ? "12px 8px" : "20px 16px 16px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt="SupaKoto"
              width={tier === "tablet" ? 32 : 120}
              height={tier === "tablet" ? 32 : undefined}
              style={{
                display: "block",
                margin: tier === "tablet" ? "0 auto" : undefined,
                objectFit: "contain",
              }}
            />
          </div>

          <nav
            style={{
              flex: 1,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflowY: "auto",
            }}
          >
            {navItems.map((item) => {
              const active = currentPage === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  title={tier === "tablet" ? item.label : undefined}
                  style={{
                    ...navLinkBase,
                    ...(active ? navLinkActive : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "var(--surface-elevated)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  {tier !== "tablet" && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              padding: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 0,
            }}
          >
            <div
              title={tier === "tablet" ? agent?.name : undefined}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(191,30,46,0.15)",
                border: "1px solid rgba(191,30,46,0.30)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--brand-red)",
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            {tier !== "tablet" && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {agent?.name ?? "—"}
                </div>
                <div style={roleBadgeStyle()}>{roleLabel()}</div>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Sign out"
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: 4,
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--brand-red)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              →
            </button>
          </div>
        </aside>
      )}

      <main
        className="app-content"
        style={{
          marginLeft: showSidebar ? sidebarW : 0,
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </main>

      {tier === "mobile" && (
        <nav
          className="bottom-tab-bar app-shell-bottom-nav"
          style={{
            gridTemplateColumns: `repeat(${navItems.length}, 1fr)`,
          }}
        >
          {navItems.map((item) => {
            const active = currentPage === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`bottom-tab-btn${active ? " bottom-tab-btn--active" : ""}`}
                style={{ textDecoration: "none" }}
              >
                {active && (
                  <span className="bottom-tab-indicator" aria-hidden />
                )}
                <span className="bottom-tab-icon">{item.icon}</span>
                <span className="bottom-tab-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
