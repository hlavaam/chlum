import { AppShell } from "@/components/app-shell";
import { requireRoles } from "@/lib/auth/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoles(["manager", "admin"]);
  const nav = [
    { href: "/employees", label: "Kalendář" },
    ...(user.role === "admin" ? [{ href: "/employees/my", label: "Moje směny" }] : []),
    { href: "/admin/schedule", label: "Admin" },
    { href: "/admin/events", label: "Eventy" },
    ...(user.role === "admin" ? [{ href: "/admin/people", label: "Lidé & pobočky" }] : []),
  ];

  return (
    <AppShell
      title="Admin / Plánování"
      subtitle="Správa směn, eventů a obsazení"
      user={user}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
