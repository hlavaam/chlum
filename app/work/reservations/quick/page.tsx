import { QuickReservationForm } from "@/components/quick-reservation-form";
import { WorkAppFrame } from "@/components/work-app-frame";
import { requireRoles } from "@/lib/auth/rbac";
import { workPaths } from "@/lib/paths";
import { filterBaseLocations } from "@/lib/services/base-locations";
import { getLocationsCached } from "@/lib/services/cached-reads";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function WorkQuickReservationPage({ searchParams }: Props) {
  await requireRoles(["manager", "admin"], {
    loginPath: workPaths.login,
    fallbackPath: workPaths.reservations,
  });

  const params = await searchParams;
  const reservationMessage = readString(params, "reservationMessage");
  const reservationError = readString(params, "reservationError");
  const locations = filterBaseLocations(await getLocationsCached());

  return (
    <WorkAppFrame>
      <QuickReservationForm
        locations={locations.map((location) => ({ id: location.id, name: location.name, code: location.code }))}
        reservationMessage={reservationMessage}
        reservationError={reservationError}
      />
    </WorkAppFrame>
  );
}
