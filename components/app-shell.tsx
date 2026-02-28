"use client";

import { usePathname, useRouter } from "next/navigation";
import { AppLink } from "@/components/app-link";

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

export function AppShell({ title: _title, subtitle, user, nav, children }: AppShellProps) {
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
          <p className="topbar-description">{subtitle ?? "Měsíční a týdenní plán restaurace, svateb a eventů"}</p>
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
          <AppLink
            key={item.href}
            href={item.href}
            className={cx("tab", pathname === item.href && "active")}
          >
            {item.label}
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
          </AppLink>
        ))}
      </nav>
    </div>
  );
}
