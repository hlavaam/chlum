import { AppLink } from "@/components/app-link";
import { BaseReservationsBoard } from "@/components/base-reservations-board";
import { WorkAppFrame } from "@/components/work-app-frame";
import { requireRoles } from "@/lib/auth/rbac";
import { workPaths } from "@/lib/paths";
import { filterBaseLocations } from "@/lib/services/base-locations";
import { baseReservationsService } from "@/lib/services/base-reservations";
import { getLocationsCached } from "@/lib/services/cached-reads";
import { getTelegramSetupSummary } from "@/lib/telegram-reservations";
import { getMonthGrid, parseDateKey, startOfMonth, toDateKey } from "@/lib/utils";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function WorkReservationsPage({ searchParams }: Props) {
  await requireRoles(["manager", "admin"], {
    loginPath: workPaths.login,
    fallbackPath: workPaths.schedule,
  });

  const params = await searchParams;
  const date = readString(params, "date") || toDateKey(new Date());
  const anchor = parseDateKey(date);
  const monthDays = getMonthGrid(anchor);
  const monthStart = monthDays[0];
  const monthEnd = monthDays[monthDays.length - 1];
  const [locations, reservations] = await Promise.all([
    getLocationsCached(),
    baseReservationsService.forDateRange(monthStart, monthEnd),
  ]);

  const baseLocations = filterBaseLocations(locations);
  const locationMap = new Map(baseLocations.map((location) => [location.id, location]));
  const reservationsByDate = new Map<string, typeof reservations>();

  for (const reservation of reservations) {
    if (!locationMap.has(reservation.locationId)) continue;
    const list = reservationsByDate.get(reservation.date) ?? [];
    list.push(reservation);
    reservationsByDate.set(reservation.date, list);
  }

  for (const list of reservationsByDate.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time));
  }

  const days = monthDays.map((day) => {
    const currentDate = parseDateKey(day);
    return {
      date: day,
      dayNumber: currentDate.getDate(),
      inCurrentMonth: currentDate.getMonth() === anchor.getMonth() && currentDate.getFullYear() === anchor.getFullYear(),
      isToday: day === toDateKey(new Date()),
      reservations: (reservationsByDate.get(day) ?? []).map((reservation) => ({
        id: reservation.id,
        time: reservation.time,
        partySize: reservation.partySize,
        name: reservation.name,
        notes: reservation.notes,
        locationId: reservation.locationId,
        locationLabel: locationMap.get(reservation.locationId)?.name ?? reservation.locationId,
      })),
    };
  });

  const monthLabel = new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
  }).format(startOfMonth(anchor));
  const telegramSetup = getTelegramSetupSummary();

  return (
    <WorkAppFrame>
      <div className="stack gap-lg">
        <section className="panel stack gap-lg">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Rezervace</p>
              <h1>{monthLabel}</h1>
            </div>
            <div className="row gap-sm wrap">
              <AppLink className="button" href={workPaths.reservationsKiosk}>
                Formulář
              </AppLink>
            </div>
          </div>
          <p className="subtle">
            Tady může manager a admin přidávat rezervace napřímo. Stejné rezervace se propisují i do detailu dne a do Základny.
          </p>
          {baseLocations.length === 0 ? (
            <p className="alert">Nejsou dostupné žádné pobočky pro rezervace.</p>
          ) : (
            <BaseReservationsBoard
              monthLabel={monthLabel}
              previousHref={`${workPaths.reservations}?date=${toDateKey(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}`}
              nextHref={`${workPaths.reservations}?date=${toDateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}`}
              days={days}
              locations={baseLocations.map((location) => ({ id: location.id, name: location.name, code: location.code }))}
              defaultLocationId={baseLocations[0]?.id ?? ""}
            />
          )}
        </section>

        <section className="panel stack gap-sm">
          <div className="row between wrap align-center">
            <div>
              <p className="eyebrow">Telegram bot</p>
              <h2>Chat pro rezervace zdarma</h2>
            </div>
            <span className={`badge ${telegramSetup.configured ? "success" : "warning"}`}>
              {telegramSetup.configured ? "Konfigurace nalezena" : "Chybí secrets"}
            </span>
          </div>
          <p className="subtle">
            Bot ukládá rezervace do stejného systému jako web. Manager nebo admin může napsat volný text, spustit průvodce `rez`, nebo přes `smaz`
            vybrat a odstranit existující rezervaci.
          </p>
          <p><strong>Webhook URL:</strong> {telegramSetup.webhookUrl}</p>
          <p><strong>Secrets:</strong> `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_USER_MAP`, volitelně `TELEGRAM_DEFAULT_LOCATION_MAP`.</p>
          <p><strong>Příklady zpráv:</strong> `CHLUM 2.5. 12:00 3 osoby`, `CHLUM 3.3. 13 5x Novak`, `rez`, `smaz`.</p>
          <p className="subtle">Mapování chatů se zadává jako `chatId:userId`, například `123456789:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2`.</p>
        </section>
      </div>
    </WorkAppFrame>
  );
}
