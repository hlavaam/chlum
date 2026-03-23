import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/rbac";
import { staffPaths } from "@/lib/paths";

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = [
    { href: staffPaths.employees, label: "Kalendář" },
    ...(user.role === "brigadnik" || user.role === "admin"
      ? [{ href: staffPaths.employeesMy, label: "Moje směny" }]
      : []),
    { href: staffPaths.adminSchedule, label: "Admin" },
  ].filter((item) => (item.href.startsWith(`${staffPaths.root}/admin`) ? ["manager", "admin"].includes(user.role) : true));

  return (
    <AppShell
      title="Brigádníci"
      subtitle="Měsíční a týdenní plán restaurace, svateb a eventů"
      user={user}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}

