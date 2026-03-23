import { DailyMenuAdmin } from "@/components/daily-menu-admin";
import { requireRoles } from "@/lib/auth/rbac";
import { adminPaths } from "@/lib/paths";

export default async function AdminMenuPage() {
  await requireRoles(["manager", "admin"], {
    loginPath: adminPaths.login,
    fallbackPath: adminPaths.adminMenu,
  });

  return <DailyMenuAdmin />;
}
