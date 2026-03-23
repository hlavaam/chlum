import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { adminPaths, workPaths } from "@/lib/paths";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "manager" && user.role !== "admin")) {
    return <>{children}</>;
  }
  const nav = [
    { href: adminPaths.adminMenu, label: "Jídelák" },
    { href: adminPaths.adminSchedule, label: "Směny" },
    { href: adminPaths.adminEvents, label: "Eventy" },
    ...(user.role === "admin" ? [{ href: adminPaths.adminPeople, label: "Lidé & pobočky" }] : []),
    { href: workPaths.employees, label: "Work" },
  ];

  return (
    <AppShell
      title="Admin / Plánování"
      subtitle="Správa webu, jídeláku, směn a provozu restaurace"
      eyebrow="Admin / Restaurace Vyskeř"
      logoutPath={adminPaths.login}
      user={user}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
