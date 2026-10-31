"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "./api";
import { Brand } from "./brand";
import { SessionContext, type SessionUser } from "./session";
const links = [
  { href: "/", label: "Overview", icon: "◫" },
  { href: "/subscriptions", label: "Subscriptions", icon: "↻" },
  { href: "/invoices", label: "Invoices", icon: "▤" },
  { href: "/account", label: "My account", icon: "◎" },
];
export function AppShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const current = path.startsWith("/portal/invoices") ? "/invoices" : path;
  useEffect(() => {
    let alive = true;
    api<{ user: SessionUser } | null>("/api/auth/get-session")
      .then((value) => {
        if (!alive) return;
        if (!value) router.replace("/login");
        else setUser(value.user);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [router]);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {if (event.key === "Escape") setOpen(false);};
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  async function logout() {
    try {
      await api("/api/auth/sign-out", { method: "POST", body: "{}" });
      router.replace("/login");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!user)
    return (
      <main className="session-loading">
        <Brand />
        <p role="status">{error || "Opening your workspace…"}</p>
        {error && <button onClick={() => location.reload()}>Try again</button>}
      </main>
    );
  return (
    <SessionContext.Provider value={user}>
      <div className="app-shell">
        <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
          <Brand />
          <div className="workspace-label">
            <span className="workspace-icon">B</span>
            <span>
              Brightloop workspace
              <small>
                {user.role === "CUSTOMER"
                  ? "Customer portal"
                  : "Subscription management"}
              </small>
            </span>
            <span className="muted">⌄</span>
          </div>
          <p className="nav-caption">WORKSPACE</p>
          <nav id="workspace-navigation" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  current === link.href ||
                  (link.href !== "/" && current.startsWith(link.href))
                    ? "nav-link active"
                    : "nav-link"
                }
                aria-current={current === link.href ? "page" : undefined}
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="help-card">
              <span className="help-symbol">↗</span>
              <strong>A little less admin.</strong>
              <p>More space to grow your business.</p>
            </div>
            <button className="profile-button" title="Sign out" onClick={logout}>
              <span className="avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                {user.name}
                <small>{user.role.toLowerCase()}</small>
              </span>
              <span aria-hidden="true">↪</span>
              <span className="sr-only">Sign out</span>
            </button>
          </div>
        </aside>
        {open && (
          <button
            className="nav-scrim"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        )}
        <div className="main-column">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="menu-toggle"
                aria-label="Open navigation"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
              >
                ☰
              </button>
              <span>Workspace</span>
              <span className="crumb-divider">/</span>
              <strong>
                {links.find(
                  (link) => link.href !== "/" && current.startsWith(link.href),
                )?.label || "Overview"}
              </strong>
            </div>
            <div className="topbar-right">
              <span className="workspace-status">
                <i />{" "}
                {user.role === "CUSTOMER"
                  ? "Your portal"
                  : "Brightloop Software"}
              </span>
              <Link
                className="avatar avatar-small"
                href="/account"
                aria-label="Your account"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </Link>
            </div>
          </header>
          <main className="page-content">
            {error && (
              <div role="alert" className="notice notice-error">
                {error}
              </div>
            )}
            {children}
          </main>
          <footer className="app-footer">
            <span>Brightloop · Subscription management, simplified.</span>
            <span>Made for what's next.</span>
          </footer>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
