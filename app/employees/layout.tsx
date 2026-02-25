import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/rbac";

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = [
    { href: "/employees", label: "Kalendář" },
    ...(user.role === "brigadnik" ? [{ href: "/employees/my", label: "Moje směny" }] : []),
    { href: `/admin/schedule`, label: "Admin" },
  ].filter((item) => (item.href.startsWith("/admin") ? ["manager", "admin"].includes(user.role) : true));

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
