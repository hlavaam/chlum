import { DayDetailView } from "@/components/day-detail-view";
import { requireUser } from "@/lib/auth/rbac";
import { staffPaths } from "@/lib/paths";

type Props = {
  params: Promise<{ date: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DayPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const { date } = await params;
  const query = await searchParams;
  const shiftId = readString(query?.shiftId) ?? null;
  const reservationMessage = readString(query?.reservationMessage) || null;
  const reservationError = readString(query?.reservationError) || null;

  return (
    <DayDetailView
      date={date}
      user={user}
      redirectTo={staffPaths.employeeDay(date, shiftId ?? undefined)}
      selectedShiftId={shiftId}
      reservationMessage={reservationMessage}
      reservationError={reservationError}
    />
  );
}
