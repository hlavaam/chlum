"use client";

import { usePathname, useRouter } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { staffPaths } from "@/lib/paths";
import type { AppRole } from "@/types/models";

type NavItem = { href: string; label: string };
type UserRecordLike = {
  name: string;
  role: AppRole;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  logoutPath?: string;
  user: UserRecordLike;
  nav: Array<NavItem & { badge?: number }>;
  children: React.ReactNode;
}

export function AppShell({ title: _title, subtitle, eyebrow, logoutPath, user, nav, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(logoutPath ?? staffPaths.login);
    router.refresh();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{eyebrow ?? "Správa brigádníků"}</p>
          {subtitle ? <p className="topbar-description">{subtitle}</p> : null}
        </div>
        <div className="topbar-actions">
          <div className="user-chip">
            <span className="user-chip-initials">{initials(user.name)}</span>
            <strong>{user.name}</strong>
          </div>
          <button className="icon-button logout-icon-button" type="button" onClick={handleLogout} aria-label="Odhlásit">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M8 3.75h-2.5A1.75 1.75 0 0 0 3.75 5.5v9A1.75 1.75 0 0 0 5.5 16.25H8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
              <path
                d="M11 6.5 14.5 10 11 13.5M14.5 10h-8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
      </header>

      <nav className="tabs">
        {nav.map((item) => (
          <AppLink
            key={item.href}
            href={item.href}
            className={cx("tab", pathname === item.href && "active")}
          >
            <span>{item.label}</span>
            {item.badge && item.badge > 0 ? <span className="nav-badge">{item.badge}</span> : null}
          </AppLink>
        ))}
      </nav>

      <main className="content">{children}</main>

      <nav className="mobile-nav" aria-label="Mobilní navigace">
        {nav.map((item) => (
          <AppLink
            key={`mobile-${item.href}`}
            href={item.href}
            className={cx("mobile-nav-link", pathname === item.href && "active")}
          >
            <span>{item.label}</span>
            {item.badge && item.badge > 0 ? <span className="nav-badge">{item.badge}</span> : null}
          </AppLink>
        ))}
      </nav>
    </div>
  );
}
