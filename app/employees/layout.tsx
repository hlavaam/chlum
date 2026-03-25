import { redirect } from "next/navigation";

import { WorkAppFrame } from "@/components/work-app-frame";
import { isBaseRole } from "@/lib/auth/role-access";
import { requireUser } from "@/lib/auth/rbac";
import { workPaths } from "@/lib/paths";

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ loginPath: workPaths.login });
  if (isBaseRole(user.role)) {
    redirect(workPaths.base);
  }
  return <WorkAppFrame>{children}</WorkAppFrame>;
}
