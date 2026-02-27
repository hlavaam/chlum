"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type NavItem = { href: string; label: string };
type AppRole = "brigadnik" | "manager" | "admin";
type UserRecordLike = {
  name: string;
  role: AppRole;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  user: UserRecordLike;
  nav: NavItem[];
  children: React.ReactNode;
}

export function AppShell({ title, subtitle, user, nav, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Správa brigádníků</p>
          <h1>{title}</h1>
          {subtitle ? <p className="subtle">{subtitle}</p> : null}
        </div>
        <div className="topbar-actions">
          <div className="user-chip">
            <strong>{user.name}</strong>
          </div>
          <button className="button ghost" type="button" onClick={handleLogout}>
            Odhlásit
          </button>
        </div>
      </header>

      <nav className="tabs">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cx("tab", pathname === item.href && "active")}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="content">{children}</main>

      <nav className="mobile-nav" aria-label="Mobilní navigace">
        {nav.map((item) => (
          <Link
            key={`mobile-${item.href}`}
            href={item.href}
            prefetch={false}
            className={cx("mobile-nav-link", pathname === item.href && "active")}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
