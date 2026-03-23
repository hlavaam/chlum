import { AppShell } from "@/components/app-shell";
import { requireRoles } from "@/lib/auth/rbac";
import { staffPaths } from "@/lib/paths";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoles(["manager", "admin"]);
  const nav = [
    { href: staffPaths.employees, label: "Kalendář" },
    ...(user.role === "admin" ? [{ href: staffPaths.employeesMy, label: "Moje směny" }] : []),
    { href: staffPaths.adminSchedule, label: "Admin" },
    { href: staffPaths.adminEvents, label: "Eventy" },
    { href: staffPaths.adminMenu, label: "Denní menu" },
    ...(user.role === "admin" ? [{ href: staffPaths.adminPeople, label: "Lidé & pobočky" }] : []),
  ];

  return (
    <AppShell
      title="Admin / Plánování"
      subtitle="Měsíční a týdenní plán restaurace, svateb a eventů"
      user={user}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
