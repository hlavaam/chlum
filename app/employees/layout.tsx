import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/rbac";
import { adminPaths, workPaths } from "@/lib/paths";

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ loginPath: workPaths.login });
  const nav = [
    { href: workPaths.employees, label: "Kalendář" },
    ...(user.role === "brigadnik" || user.role === "admin"
      ? [{ href: workPaths.employeesMy, label: "Moje směny" }]
      : []),
    ...(user.role === "manager" || user.role === "admin"
      ? [{ href: adminPaths.adminMenu, label: "Admin" }]
      : []),
  ];

  return (
    <AppShell
      title="Brigádníci"
      subtitle="Měsíční a týdenní plán restaurace, svateb a eventů"
      eyebrow="Work / Brigádníci"
      logoutPath={workPaths.login}
      user={user}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
