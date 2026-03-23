import { DailyMenuAdmin } from "@/components/daily-menu-admin";
import { requireRoles } from "@/lib/auth/rbac";

export default async function AdminMenuPage() {
  await requireRoles(["manager", "admin"]);

  return <DailyMenuAdmin />;
}
