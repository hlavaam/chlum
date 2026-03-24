import { AppShell } from "@/components/app-shell";
import { canUseWorkRole, isManagerRole } from "@/lib/auth/role-access";
import { requireUser } from "@/lib/auth/rbac";
import { workPaths } from "@/lib/paths";
import { assignmentsService } from "@/lib/services/assignments";

export async function WorkAppFrame({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ loginPath: workPaths.login });
  const pendingApprovals = isManagerRole(user.role)
    ? (await assignmentsService.loadAll()).filter((assignment) => assignment.status === "pending").length
    : 0;
  const nav = [
    { href: workPaths.employees, label: "Kalendář" },
    ...(canUseWorkRole(user.role) ? [{ href: workPaths.employeesMy, label: "Moje směny" }] : []),
    ...(canUseWorkRole(user.role) ? [{ href: workPaths.base, label: "Základna" }] : []),
    ...(canUseWorkRole(user.role) ? [{ href: workPaths.profile, label: "Profil" }] : []),
    ...(isManagerRole(user.role)
      ? [
          { href: workPaths.schedule, label: "Směny" },
          { href: workPaths.approvals, label: "Schválení", badge: pendingApprovals },
          { href: workPaths.events, label: "Eventy" },
        ]
      : []),
    ...(isManagerRole(user.role) ? [{ href: workPaths.people, label: "Lidé & role" }] : []),
  ];

  return (
    <AppShell
      title="Work / Brigádníci"
      eyebrow="/WORK"
      logoutPath={workPaths.login}
      user={user}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
