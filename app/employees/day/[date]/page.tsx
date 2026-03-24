import { DayDetailView } from "@/components/day-detail-view";
import { requireUser } from "@/lib/auth/rbac";
import { staffPaths } from "@/lib/paths";

type Props = {
  params: Promise<{ date: string }>;
};

export default async function DayPage({ params }: Props) {
  const user = await requireUser();
  const { date } = await params;

  return <DayDetailView date={date} user={user} redirectTo={staffPaths.employeeDay(date)} />;
}
