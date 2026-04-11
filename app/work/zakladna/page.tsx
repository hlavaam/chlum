import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppLink } from "@/components/app-link";
import { BaseReservationsBoard } from "@/components/base-reservations-board";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ZakladnaInstallCard } from "@/components/zakladna-install-card";
import { WorkAppFrame } from "@/components/work-app-frame";
import { WorkBaseAccessForm } from "@/components/work-base-access-form";
import { WorkBaseTerminal } from "@/components/work-base-terminal";
import {
  deleteBaseAttendanceAction,
  deleteBaseAttendanceBulkAction,
  logoutAction,
  updateBaseAttendanceAction,
} from "@/lib/actions";
import { canUseBaseTerminalRole, isBaseRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { workPaths } from "@/lib/paths";
import { baseAttendanceService } from "@/lib/services/base-attendance";
import { filterBaseLocations } from "@/lib/services/base-locations";
import { baseReservationsService } from "@/lib/services/base-reservations";
import { getDayDetailsCached, getLocationsCached, getUsersCached } from "@/lib/services/cached-reads";
import {
  endOfMonth,
  endOfWeek,
  formatCzDate,
  formatMinutes,
  getMonthGrid,
  minutesBetween,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "@/lib/utils";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDateTimeLocalValue(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function readDateKey(value: string | string[] | undefined, fallback: string) {
  const raw = readString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function isLegacyAndroidUserAgent(userAgent: string) {
  if (!/Android/i.test(userAgent)) return false;
  const androidMatch = userAgent.match(/Android\s+(\d+)(?:\.(\d+))?/i);
  const major = androidMatch ? Number(androidMatch[1]) : null;
  if (major !== null && Number.isFinite(major) && major <= 7) return true;
  return /\bwv\b/i.test(userAgent) || /Version\/4\.0/i.test(userAgent);
}

function appendReservationDate(path: string, reservationDate: string) {
  const url = new URL(path, "https://vysker.local");
  url.searchParams.set("reservationDate", reservationDate);
  return `${url.pathname}${url.search}`;
}

export default async function WorkBasePage({ searchParams }: Props) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const useLegacyBaseTerminal = isLegacyAndroidUserAgent(userAgent);
  const currentUser = await getCurrentUser();
  const error = readString(params?.error) === "1";
  const terminalError = readString(params?.terminalError);
  const terminalMessage = readString(params?.terminalMessage);
  const reservationError = readString(params?.reservationError);
  const reservationMessage = readString(params?.reservationMessage);
  const requestedLocationId = readString(params?.locationId);
  const requestedUserId = readString(params?.userId);
  const keypadDigit = readString(params?.keypadDigit).replace(/\D/g, "").slice(0, 1);
  const keypadAction = readString(params?.keypadAction);
  const requestedPinRaw = readString(params?.pin).replace(/\D/g, "").slice(0, 4);
  const zakladnaVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
  const requestedPin =
    keypadAction === "clear"
      ? ""
      : keypadAction === "backspace"
        ? requestedPinRaw.slice(0, -1)
        : keypadDigit
          ? `${requestedPinRaw}${keypadDigit}`.slice(0, 4)
          : requestedPinRaw;

  if (!currentUser) {
    return (
      <div className="login-page">
        <div className="login-card">
          <WorkBaseAccessForm error={error} />
        </div>
      </div>
    );
  }

  if (!canUseBaseTerminalRole(currentUser.role)) {
    redirect(workPaths.employees);
  }

  const todayDate = toDateKey(new Date());
  const selectedTab = readString(params?.tab) === "reservations" ? "reservations" : "attendance";
  const selectedRange = readString(params?.range) === "week" ? "week" : "month";
  const selectedDate = readDateKey(params?.date, todayDate);
  const selectedReservationDate = readDateKey(params?.reservationDate, selectedDate);
  const selectedDateValue = parseDateKey(selectedDate);
  const periodStart = selectedRange === "week" ? startOfWeek(selectedDateValue) : startOfMonth(selectedDateValue);
  const periodEnd = selectedRange === "week" ? endOfWeek(selectedDateValue) : endOfMonth(selectedDateValue);
  const periodStartKey = toDateKey(periodStart);
  const periodEndKey = toDateKey(periodEnd);
  const redirectTo = workPaths.baseWithParams({ date: selectedDate, range: selectedRange, tab: selectedTab });
  const attendanceHref = workPaths.baseWithParams({ date: selectedDate, range: selectedRange, tab: "attendance" });
  const reservationsHref = workPaths.baseWithParams({ date: selectedDate, range: selectedRange, tab: "reservations" });
  const reservationMonthDays = getMonthGrid(selectedDateValue);
  const reservationMonthStart = reservationMonthDays[0];
  const reservationMonthEnd = reservationMonthDays[reservationMonthDays.length - 1];
  const previousReservationMonthHref = workPaths.baseWithParams({
    date: toDateKey(new Date(selectedDateValue.getFullYear(), selectedDateValue.getMonth() - 1, 1)),
    range: selectedRange,
    tab: "reservations",
  });
  const nextReservationMonthHref = workPaths.baseWithParams({
    date: toDateKey(new Date(selectedDateValue.getFullYear(), selectedDateValue.getMonth() + 1, 1)),
    range: selectedRange,
    tab: "reservations",
  });

  const [locations, users, records, activeRecords, todayDetails, monthReservations] = await Promise.all([
    getLocationsCached(),
    getUsersCached(),
    baseAttendanceService.loadAll(),
    baseAttendanceService.active(),
    getDayDetailsCached(todayDate),
    baseReservationsService.forDateRange(reservationMonthStart, reservationMonthEnd),
  ]);

  const baseLocations = filterBaseLocations(locations);

  const allowedLocationIds = isBaseRole(currentUser.role) ? new Set(currentUser.locationIds) : null;
  const visibleBaseLocations = isBaseRole(currentUser.role)
    ? baseLocations.filter((location) => allowedLocationIds?.has(location.id))
    : baseLocations;

  const activeRecordByUserId = new Map(activeRecords.map((record) => [record.userId, record] as const));
  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const visibleBaseLocationIds = new Set(visibleBaseLocations.map((location) => location.id));
  const reservationsByDate = new Map<
    string,
    Array<{
      id: string;
      time: string;
      partySize: number;
      name?: string;
      notes?: string;
      locationId: string;
      locationLabel: string;
    }>
  >();
  for (const reservation of monthReservations) {
    if (!visibleBaseLocationIds.has(reservation.locationId)) continue;
    const list = reservationsByDate.get(reservation.date) ?? [];
    list.push({
      id: reservation.id,
      time: reservation.time,
      partySize: reservation.partySize,
      name: reservation.name,
      notes: reservation.notes,
      locationId: reservation.locationId,
      locationLabel: locationMap.get(reservation.locationId)?.name ?? reservation.locationId,
    });
    reservationsByDate.set(reservation.date, list);
  }
  for (const list of reservationsByDate.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time));
  }
  const userById = new Map(users.map((user) => [user.id, user]));
  const rosterSeedByLocation = new Map<
    string,
    Map<
      string,
      {
        userId: string;
        name: string;
        present: boolean;
        waiting: boolean;
        done: boolean;
        clockInTime: string | null;
        clockOutTime: string | null;
      }
    >
  >();

  function ensureRosterEntry(locationId: string, userId: string, name: string) {
    const rosterMap = rosterSeedByLocation.get(locationId) ?? new Map();
    const existing = rosterMap.get(userId);
    if (existing) return existing;
    const created = {
      userId,
      name,
      present: false,
      waiting: false,
      done: false,
      clockInTime: null,
      clockOutTime: null,
    };
    rosterMap.set(userId, created);
    rosterSeedByLocation.set(locationId, rosterMap);
    return created;
  }

  for (const detail of todayDetails) {
    if (allowedLocationIds && !allowedLocationIds.has(detail.shift.locationId)) continue;
    for (const assignment of detail.assignments) {
      const user = userById.get(assignment.userId);
      if (!user || user.role === "base" || !user.active) continue;
      const entry = ensureRosterEntry(detail.shift.locationId, user.id, user.name);
      entry.waiting = true;
    }
  }

  const latestTodayRecordByLocationAndUser = new Map<string, (typeof records)[number]>();
  const todayRecords = [...records]
    .filter((record) => {
      if (record.clockInAt.slice(0, 10) !== todayDate) return false;
      if (!allowedLocationIds) return true;
      return allowedLocationIds.has(record.clockInLocationId) || (record.clockOutLocationId ? allowedLocationIds.has(record.clockOutLocationId) : false);
    })
    .sort((a, b) => (b.clockOutAt ?? b.clockInAt).localeCompare(a.clockOutAt ?? a.clockInAt));

  for (const record of todayRecords) {
    const key = `${record.clockInLocationId}:${record.userId}`;
    if (!latestTodayRecordByLocationAndUser.has(key)) {
      latestTodayRecordByLocationAndUser.set(key, record);
    }
  }

  for (const record of activeRecords) {
    if (allowedLocationIds && !allowedLocationIds.has(record.clockInLocationId)) continue;
    const user = userById.get(record.userId);
    if (!user || user.role === "base" || !user.active) continue;
    ensureRosterEntry(record.clockInLocationId, user.id, user.name);
  }

  for (const [key, record] of latestTodayRecordByLocationAndUser) {
    const [locationId, userId] = key.split(":");
    const user = userById.get(userId);
    if (!user || user.role === "base" || !user.active) continue;
    const entry = ensureRosterEntry(locationId, user.id, user.name);
    entry.waiting = false;
    entry.done = Boolean(record.clockOutAt);
    entry.clockInTime = formatTime(record.clockInAt);
    entry.clockOutTime = record.clockOutAt ? formatTime(record.clockOutAt) : null;
  }

  for (const record of activeRecords) {
    if (allowedLocationIds && !allowedLocationIds.has(record.clockInLocationId)) continue;
    const user = userById.get(record.userId);
    if (!user || user.role === "base" || !user.active) continue;
    const entry = ensureRosterEntry(record.clockInLocationId, user.id, user.name);
    entry.present = true;
    entry.waiting = false;
    entry.done = false;
    entry.clockInTime = formatTime(record.clockInAt);
    entry.clockOutTime = null;
  }

  const rosterByLocation = new Map(
    visibleBaseLocations.map((location) => [
      location.id,
      Array.from((rosterSeedByLocation.get(location.id) ?? new Map()).values()).sort((a, b) => {
        if (a.present !== b.present) return a.present ? -1 : 1;
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.name.localeCompare(b.name, "cs");
      }),
    ] as const),
  );

  const punchableUsers = users
    .filter((user) => user.active && user.role !== "base")
    .sort((a, b) => a.name.localeCompare(b.name));

  const terminalUsers = punchableUsers
    .map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      activeRecord: activeRecordByUserId.get(user.id)
        ? {
            clockInAt: activeRecordByUserId.get(user.id)?.clockInAt ?? "",
            locationId: activeRecordByUserId.get(user.id)?.clockInLocationId ?? "",
          }
        : null,
    }));
  const terminal = (
    <WorkBaseTerminal
      key={`terminal:${useLegacyBaseTerminal ? "legacy" : "modern"}:${requestedLocationId}:${requestedUserId}:${requestedPin}:${terminalMessage}:${terminalError}`}
      locations={visibleBaseLocations.map((location) => ({ id: location.id, name: location.name, code: location.code }))}
      users={terminalUsers}
      rosterByLocation={Object.fromEntries(
        visibleBaseLocations.map((location) => [location.id, rosterByLocation.get(location.id) ?? []]),
      )}
      lockSingleLocation={visibleBaseLocations.length <= 1}
      compactMode={isBaseRole(currentUser.role)}
      legacyMode={isBaseRole(currentUser.role) && useLegacyBaseTerminal}
      redirectTo={redirectTo}
      initialLocationId={requestedLocationId}
      initialUserId={requestedUserId}
      initialPin={requestedPin}
      initialMessage={terminalMessage || null}
      initialError={terminalError || null}
    />
  );
  const reservationMonthLabel = new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
  }).format(startOfMonth(selectedDateValue));
  const reservationDays = reservationMonthDays.map((date) => {
    const currentDate = parseDateKey(date);
    return {
      date,
      dayNumber: currentDate.getDate(),
      inCurrentMonth: currentDate.getMonth() === selectedDateValue.getMonth() && currentDate.getFullYear() === selectedDateValue.getFullYear(),
      isToday: date === todayDate,
      reservations: reservationsByDate.get(date) ?? [],
    };
  });
  const activeReservationDay = reservationDays.find((day) => day.date === selectedReservationDate) ?? null;
  const legacyReservationRedirect = `${reservationsHref}${reservationsHref.includes("?") ? "&" : "?"}reservationDate=${selectedReservationDate}`;
  const reservationsBoard = (
    <BaseReservationsBoard
      monthLabel={reservationMonthLabel}
      previousHref={previousReservationMonthHref}
      nextHref={nextReservationMonthHref}
      days={reservationDays}
      locations={visibleBaseLocations.map((location) => ({ id: location.id, name: location.name, code: location.code }))}
      defaultLocationId={visibleBaseLocations[0]?.id ?? ""}
    />
  );
  const legacyReservationsBoard = (
    <section className="panel stack gap-lg">
      <div className="row between wrap">
        <div>
          <p className="eyebrow">Rezervace</p>
          <h2>{reservationMonthLabel}</h2>
        </div>
        <div className="row gap-sm wrap">
          <AppLink className="button ghost small" href={previousReservationMonthHref}>
            Predchozi mesic
          </AppLink>
          <AppLink className="button ghost small" href={nextReservationMonthHref}>
            Dalsi mesic
          </AppLink>
        </div>
      </div>
      <p className="subtle">Klikni na den a dole se otevře jednoduchý formulář rezervace pro starší Android.</p>
      {reservationMessage ? <p className="badge success">{reservationMessage}</p> : null}
      {reservationError ? <p className="alert">{reservationError}</p> : null}
      <div className="base-reservations-grid">
        {["Po", "Ut", "St", "Ct", "Pa", "So", "Ne"].map((weekday) => (
          <div key={`legacy-weekday-${weekday}`} className="base-calendar-weekday">
            {weekday}
          </div>
        ))}
        {reservationDays.map((day) => (
          <a
            key={`legacy-day-${day.date}`}
            href={appendReservationDate(reservationsHref, day.date)}
            className={`base-calendar-day ${day.inCurrentMonth ? "" : "outside"} ${day.isToday ? "today" : ""}`.trim()}
          >
              <span className="base-calendar-day-number">{day.dayNumber}.</span>
              <div className="base-calendar-day-list">
                {day.reservations.length === 0 ? <span className="subtle tiny">Bez rezervace</span> : null}
                {day.reservations.slice(0, 3).map((item) => (
                  <span key={item.id} className="base-calendar-chip">
                    {item.time} • {item.partySize} os.
                  </span>
                ))}
              </div>
          </a>
        ))}
      </div>
      {activeReservationDay ? (
        <section className="base-day-edit-card stack gap-sm">
          <div>
            <p className="eyebrow">Vybrany den</p>
            <h3>{activeReservationDay.date}</h3>
          </div>
          {activeReservationDay.reservations.length === 0 ? <p className="subtle">Na tenhle den zatim neni zadna rezervace.</p> : null}
          {activeReservationDay.reservations.length > 0 ? (
            <div className="stack gap-sm">
              {activeReservationDay.reservations.map((item) => (
                <article key={`legacy-reservation-${item.id}`} className="base-reservation-list-item">
                  <div className="row between wrap gap-sm align-center">
                    <div className="stack gap-sm">
                      <p>
                        <strong>{item.time}</strong> • {item.partySize} osob • {item.locationLabel}
                      </p>
                      <p className="tiny subtle">
                        {item.name ? item.name : "Bez jmena"}
                        {item.notes ? ` • ${item.notes}` : ""}
                      </p>
                    </div>
                    <form action="/api/work/base/reservations/delete" method="post">
                      <input type="hidden" name="reservationId" value={item.id} />
                      <input type="hidden" name="redirectTo" value={legacyReservationRedirect} />
                      <button type="submit" className="button ghost danger small">
                        Smazat
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <form className="stack gap-sm" action="/api/work/base/reservations" method="post">
            <input type="hidden" name="redirectTo" value={legacyReservationRedirect} />
            <input type="hidden" name="date" value={activeReservationDay.date} />
            {visibleBaseLocations.length > 1 ? (
              <label>
                Pobocka
                <select name="locationId" defaultValue={visibleBaseLocations[0]?.id ?? ""}>
                  {visibleBaseLocations.map((location) => (
                    <option key={`legacy-res-location-${location.id}`} value={location.id}>
                      {location.code} • {location.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="locationId" value={visibleBaseLocations[0]?.id ?? ""} />
            )}
            <label>
              Cas
              <input type="time" name="time" defaultValue="18:00" required />
            </label>
            <label>
              Pocet osob
              <input type="number" name="partySize" min={1} max={40} defaultValue={2} required />
            </label>
            <label>
              Jmeno
              <input type="text" name="name" placeholder="Nepovinne" />
            </label>
            <label>
              Poznamka
              <textarea name="notes" rows={3} placeholder="Nepovinne" />
            </label>
            <button type="submit" className="button">Pridat rezervaci</button>
          </form>
        </section>
      ) : null}
    </section>
  );
  const totalReservationCount = Array.from(reservationsByDate.values()).reduce((sum, items) => sum + items.length, 0);

  const todayLocationOverview = visibleBaseLocations
    .map((location) => ({
      location,
      entries: rosterByLocation.get(location.id) ?? [],
    }))
    .filter((entry) => entry.entries.length > 0);
  const periodRecords = [...records]
    .filter((record) => {
      const recordDate = record.clockInAt.slice(0, 10);
      if (recordDate < periodStartKey || recordDate > periodEndKey) return false;
      if (!allowedLocationIds) return true;
      return allowedLocationIds.has(record.clockInLocationId) || (record.clockOutLocationId ? allowedLocationIds.has(record.clockOutLocationId) : false);
    })
    .sort((a, b) => (b.clockOutAt ?? b.clockInAt).localeCompare(a.clockOutAt ?? a.clockInAt));
  const summaryRows = users
    .filter((user) => user.active && user.role !== "base")
    .map((user) => {
      const userPeriodRecords = periodRecords.filter((record) => record.userId === user.id);
      const userTodayRecords = todayRecords.filter((record) => record.userId === user.id);
      const firstTodayRecord = [...userTodayRecords].sort((a, b) => a.clockInAt.localeCompare(b.clockInAt))[0];
      const latestTodayRecord = userTodayRecords[0];
      const activeRecord = activeRecordByUserId.get(user.id) ?? null;
      const totalMinutes = userPeriodRecords.reduce(
        (sum, record) => sum + minutesBetween(record.clockInAt, record.clockOutAt ?? new Date().toISOString()),
        0,
      );
      return {
        user,
        totalMinutes,
        recordsCount: userPeriodRecords.length,
        currentLocation: activeRecord ? (locationMap.get(activeRecord.clockInLocationId)?.name ?? activeRecord.clockInLocationId) : null,
        firstTodayAt: firstTodayRecord?.clockInAt,
        lastTodayAt: latestTodayRecord?.clockOutAt,
      };
    })
    .filter((row) => row.recordsCount > 0 || row.currentLocation || row.firstTodayAt || row.lastTodayAt);
  const selectedDayRecords = periodRecords.filter((record) => record.clockInAt.slice(0, 10) === selectedDate);
  const selectedDayArrivals = selectedDayRecords.length;
  const selectedDayDepartures = selectedDayRecords.filter((record) => Boolean(record.clockOutAt)).length;
  const selectedDayOpenRecords = selectedDayRecords.filter((record) => !record.clockOutAt).length;
  const selectedDayPeople = new Set(selectedDayRecords.map((record) => record.userId)).size;
  const personDayRows = users
    .filter((user) => user.active && user.role !== "base")
    .map((user) => {
      const userRecords = periodRecords.filter((record) => record.userId === user.id);
      const recordsByDay = new Map<string, typeof userRecords>();
      for (const record of userRecords) {
        const dayKey = record.clockInAt.slice(0, 10);
        const list = recordsByDay.get(dayKey) ?? [];
        list.push(record);
        recordsByDay.set(dayKey, list);
      }

      const days = [...recordsByDay.entries()]
        .map(([date, records]) => {
          const sortedRecords = [...records].sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
          const firstInAt = sortedRecords[0]?.clockInAt;
          const closedRecords = sortedRecords.filter((record) => Boolean(record.clockOutAt));
          const lastOutAt =
            closedRecords.length > 0
              ? [...closedRecords].sort((a, b) => (a.clockOutAt ?? "").localeCompare(b.clockOutAt ?? "")).at(-1)?.clockOutAt
              : undefined;
          const totalMinutes = sortedRecords.reduce(
            (sum, record) => sum + minutesBetween(record.clockInAt, record.clockOutAt ?? new Date().toISOString()),
            0,
          );

          return {
            date,
            records: sortedRecords,
            firstInAt,
            lastOutAt,
            totalMinutes,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      const totalMinutes = userRecords.reduce(
        (sum, record) => sum + minutesBetween(record.clockInAt, record.clockOutAt ?? new Date().toISOString()),
        0,
      );

      return {
        user,
        days,
        totalMinutes,
      };
    })
    .filter((row) => row.days.length > 0)
    .sort((a, b) => a.user.name.localeCompare(b.user.name, "cs"));

  if (isBaseRole(currentUser.role)) {
    return (
      <div className="login-page base-kiosk-page">
        <div className="login-card wide-login-card stack gap-lg base-kiosk-card">
          <section className="panel base-topbar-panel">
            <div className="row between align-center wrap gap-sm">
              <div className="stack gap-sm">
                <h1 className="base-kiosk-title">Základna</h1>
                <p className="tiny subtle">Verze {zakladnaVersion}</p>
                <div className="row gap-sm wrap">
                  <AppLink className={`button small ${selectedTab === "attendance" ? "" : "ghost"}`} href={attendanceHref}>
                    Docházka
                  </AppLink>
                  <AppLink className={`button small ${selectedTab === "reservations" ? "" : "ghost"}`} href={reservationsHref}>
                    Rezervace
                  </AppLink>
                </div>
              </div>
              <div className="row gap-sm wrap align-center">
                {selectedTab === "reservations" ? <span className="badge warning">Rezervací tento měsíc: {totalReservationCount}</span> : null}
                <form action={logoutAction}>
                  <button type="submit" className="button ghost small">Odhlásit</button>
                </form>
              </div>
            </div>
          </section>
          <ZakladnaInstallCard />
          {visibleBaseLocations.length === 0 ? <p className="alert">Tomuhle účtu Základna zatím není přiřazená žádná pobočka.</p> : null}
          {selectedTab === "reservations" ? (useLegacyBaseTerminal ? legacyReservationsBoard : reservationsBoard) : terminal}
        </div>
      </div>
    );
  }

  return (
    <WorkAppFrame>
      <div className="stack gap-lg">
        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">{selectedTab === "reservations" ? "Rezervace" : "Docházka"}</p>
              <h1>Základna</h1>
              <p className="tiny subtle">Verze {zakladnaVersion}</p>
            </div>
            <span className={`badge ${selectedTab === "reservations" ? "warning" : activeRecords.length > 0 ? "warning" : "neutral"}`}>
              {selectedTab === "reservations" ? `Rezervací v měsíci: ${totalReservationCount}` : `Teď na základně: ${activeRecords.length}`}
            </span>
          </div>
          <div className="row gap-sm wrap">
            <AppLink className={`button ${selectedTab === "attendance" ? "" : "ghost"}`} href={attendanceHref}>
              Docházka
            </AppLink>
            <AppLink className={`button ${selectedTab === "reservations" ? "" : "ghost"}`} href={reservationsHref}>
              Rezervace
            </AppLink>
          </div>
          <p className="subtle">
            {selectedTab === "reservations"
              ? "Kliknutim na den otevres rezervacni okno. Rezervace jsou navazane na pobocku a zustanou viditelne i v dennim detailu managera a admina."
              : "Přihlášené účty Základna vidí jen kioskovou obrazovku. Tady jako manager, admin nebo super admin vidíš i přehledy, historii a ruční opravy."}
          </p>
        </section>

        <ZakladnaInstallCard />

        {selectedTab === "reservations" ? reservationsBoard : null}

        {selectedTab === "attendance" ? (
          <>
        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Období</p>
              <h2>Souhrn docházky</h2>
            </div>
            <span className="badge neutral">
              {selectedRange === "week" ? "Týden" : "Měsíc"}: {formatCzDate(periodStartKey)} až {formatCzDate(periodEndKey)}
            </span>
          </div>
          <form method="get" action={workPaths.base} className="row gap-sm wrap admin-inline-form">
            <label>
              Období
              <select name="range" defaultValue={selectedRange}>
                <option value="week">Týden</option>
                <option value="month">Měsíc</option>
              </select>
            </label>
            <label>
              Kotvící datum
              <input type="date" name="date" defaultValue={selectedDate} />
            </label>
            <button type="submit" className="button ghost">Načíst</button>
          </form>
          {summaryRows.length === 0 ? <p className="subtle">Ve vybraném období zatím nejsou žádné záznamy.</p> : null}
          {summaryRows.length > 0 ? (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Člověk</th>
                    <th>Aktuálně kde je</th>
                    <th>Dnes přišel</th>
                    <th>Dnes odešel</th>
                    <th>Součet za období</th>
                    <th>Záznamů</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={`summary-${row.user.id}`}>
                      <td data-label="Člověk">{row.user.name}</td>
                      <td data-label="Aktuálně kde je">{row.currentLocation ?? "Mimo základnu"}</td>
                      <td data-label="Dnes přišel">{formatDateTime(row.firstTodayAt)}</td>
                      <td data-label="Dnes odešel">{formatDateTime(row.lastTodayAt)}</td>
                      <td data-label="Součet za období">{formatMinutes(row.totalMinutes)}</td>
                      <td data-label="Záznamů">{row.recordsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {terminal}

        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Dnes na základně</p>
              <h2>Kdo je kde</h2>
            </div>
            <span className="badge neutral">{todayLocationOverview.reduce((sum, item) => sum + item.entries.length, 0)} lidí dnes v přehledu</span>
          </div>
          {todayLocationOverview.length === 0 ? <p className="subtle">Na dnešek zatím není nikdo rozepsaný ani píchnutý.</p> : null}
          <div className="grid-2">
            {todayLocationOverview.map(({ location, entries }) => (
              <article key={location.id} className="base-stat-card stack gap-sm">
                <div className="row between wrap">
                  <div>
                    <p className="eyebrow">Pobočka</p>
                    <h3>{location.name}</h3>
                  </div>
                  <span className="badge neutral">{entries.length} jmen</span>
                </div>
                <div className="stack gap-sm">
                  {entries.map((entry) => (
                    <div key={`${location.id}-${entry.userId}`} className="base-roster-item">
                      <div>
                        <p><strong>{entry.name}</strong></p>
                        <p className="tiny subtle">
                          {entry.clockInTime ? `Příchod ${entry.clockInTime}` : "Bez příchodu"}
                          {entry.clockOutTime ? ` • Odchod ${entry.clockOutTime}` : ""}
                        </p>
                      </div>
                      <span className={`badge ${entry.present ? "success" : entry.done ? "neutral" : entry.waiting ? "warning" : "neutral"}`}>
                        {entry.present ? "Přítomen" : entry.done ? "Hotovo" : entry.waiting ? "Čeká" : "Mimo"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Vybraný den</p>
              <h2>Úpravy pro {formatCzDate(selectedDate)}</h2>
            </div>
            <span className="badge neutral">{selectedDayRecords.length} logů</span>
          </div>
          <div className="row gap-sm wrap">
            <span className="badge neutral">Příchody: {selectedDayArrivals}</span>
            <span className="badge neutral">Odchody: {selectedDayDepartures}</span>
            <span className={`badge ${selectedDayOpenRecords > 0 ? "warning" : "neutral"}`}>Otevřené: {selectedDayOpenRecords}</span>
            <span className="badge neutral">Lidé: {selectedDayPeople}</span>
          </div>
          {selectedDayRecords.length === 0 ? <p className="subtle">Pro tenhle den zatím není žádný docházkový log.</p> : null}
          {selectedDayRecords.length > 0 ? (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Člověk</th>
                    <th>Příchod</th>
                    <th>Odchod</th>
                    <th>Celkem</th>
                    <th>Úprava</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayRecords.map((record) => {
                    const user = userById.get(record.userId);
                    return (
                      <tr key={`day-${record.id}`}>
                        <td data-label="Člověk">{user?.name ?? record.userId}</td>
                        <td data-label="Příchod">{formatDateTime(record.clockInAt)}</td>
                        <td data-label="Odchod">{formatDateTime(record.clockOutAt)}</td>
                        <td data-label="Celkem">{formatMinutes(minutesBetween(record.clockInAt, record.clockOutAt ?? new Date().toISOString()))}</td>
                        <td data-label="Úprava">
                          <div className="stack gap-sm">
                            <form action={updateBaseAttendanceAction} className="stack gap-sm admin-inline-form">
                              <input type="hidden" name="recordId" value={record.id} />
                              <input type="hidden" name="redirectTo" value={redirectTo} />
                              <label>
                                Příchod
                                <input type="datetime-local" name="clockInAt" defaultValue={formatDateTimeLocalValue(record.clockInAt)} required />
                              </label>
                              <label>
                                Pobočka příchodu
                                <select name="clockInLocationId" defaultValue={record.clockInLocationId}>
                                  {visibleBaseLocations.map((location) => (
                                    <option key={`day-in-${record.id}-${location.id}`} value={location.id}>
                                      {location.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Odchod
                                <input type="datetime-local" name="clockOutAt" defaultValue={formatDateTimeLocalValue(record.clockOutAt)} />
                              </label>
                              <label>
                                Pobočka odchodu
                                <select name="clockOutLocationId" defaultValue={record.clockOutLocationId ?? record.clockInLocationId}>
                                  {visibleBaseLocations.map((location) => (
                                    <option key={`day-out-${record.id}-${location.id}`} value={location.id}>
                                      {location.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button type="submit" className="button ghost small">Uložit úpravu dne</button>
                            </form>
                            <form action={deleteBaseAttendanceAction} className="row gap-sm wrap admin-inline-form">
                              <input type="hidden" name="recordId" value={record.id} />
                              <input type="hidden" name="redirectTo" value={redirectTo} />
                              <ConfirmSubmitButton
                                type="submit"
                                className="button ghost danger small"
                                confirmMessage={`Smazat docházku pro ${user?.name ?? "uživatele"}?`}
                              >
                                Smazat log
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Po lidech</p>
              <h2>Docházka po dnech</h2>
            </div>
            <span className="badge neutral">{personDayRows.length} lidí s docházkou</span>
          </div>
          <p className="subtle">
            Tady vidíš u každého člověka jednotlivé dny, první příchod, poslední odchod a pod tím rovnou editaci každého logu.
          </p>
          {personDayRows.length === 0 ? <p className="subtle">Ve vybraném období zatím není žádná docházka k editaci.</p> : null}
          <div className="stack gap-md">
            {personDayRows.map((row) => (
              <article key={`person-days-${row.user.id}`} className="base-person-card stack gap-sm">
                <div className="row between wrap align-center">
                  <div>
                    <h3>{row.user.name}</h3>
                    <p className="subtle tiny">{row.days.length} dní v období</p>
                  </div>
                  <span className="badge neutral">{formatMinutes(row.totalMinutes)}</span>
                </div>
                <div className="stack gap-sm">
                  {row.days.map((day) => (
                    <details key={`${row.user.id}-${day.date}`} className="base-person-day-card stack" open={day.date === selectedDate}>
                      <summary className="base-person-day-summary">
                        <div>
                          <strong>{formatCzDate(day.date)}</strong>
                          <p className="tiny subtle">
                            Příchod {formatDateTime(day.firstInAt)} • Odchod {formatDateTime(day.lastOutAt)}
                          </p>
                        </div>
                        <div className="row gap-sm wrap align-center">
                          <span className="badge neutral">{day.records.length} logů</span>
                          <span className={`badge ${day.records.some((record) => !record.clockOutAt) ? "warning" : "neutral"}`}>
                            {formatMinutes(day.totalMinutes)}
                          </span>
                        </div>
                      </summary>
                      <div className="stack gap-sm">
                        {day.records.map((record) => (
                          <div key={`person-record-${record.id}`} className="base-day-edit-card stack gap-sm">
                            <form action={updateBaseAttendanceAction} className="grid-form">
                              <input type="hidden" name="recordId" value={record.id} />
                              <input type="hidden" name="redirectTo" value={redirectTo} />
                              <label>
                                Příchod
                                <input type="datetime-local" name="clockInAt" defaultValue={formatDateTimeLocalValue(record.clockInAt)} required />
                              </label>
                              <label>
                                Pobočka příchodu
                                <select name="clockInLocationId" defaultValue={record.clockInLocationId}>
                                  {visibleBaseLocations.map((location) => (
                                    <option key={`person-in-${record.id}-${location.id}`} value={location.id}>
                                      {location.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Odchod
                                <input type="datetime-local" name="clockOutAt" defaultValue={formatDateTimeLocalValue(record.clockOutAt)} />
                              </label>
                              <label>
                                Pobočka odchodu
                                <select name="clockOutLocationId" defaultValue={record.clockOutLocationId ?? record.clockInLocationId}>
                                  {visibleBaseLocations.map((location) => (
                                    <option key={`person-out-${record.id}-${location.id}`} value={location.id}>
                                      {location.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="row gap-sm wrap full">
                                <button type="submit" className="button ghost small">Uložit den</button>
                              </div>
                            </form>
                            <form action={deleteBaseAttendanceAction} className="row gap-sm wrap admin-inline-form">
                              <input type="hidden" name="recordId" value={record.id} />
                              <input type="hidden" name="redirectTo" value={redirectTo} />
                              <ConfirmSubmitButton
                                type="submit"
                                className="button ghost danger small"
                                confirmMessage={`Smazat docházku pro ${row.user.name}?`}
                              >
                                Smazat log
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel stack">
          <details className="stack">
            <summary className="button ghost summary-button">
              Historie docházky a ruční opravy ({periodRecords.length})
            </summary>
            {periodRecords.length === 0 ? <p className="subtle">Ve vybraném období zatím není co upravovat.</p> : null}
            {periodRecords.length > 0 ? (
              <form action={deleteBaseAttendanceBulkAction} className="stack gap-sm">
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <div className="row gap-sm wrap">
                  <ConfirmSubmitButton
                    type="submit"
                    className="button ghost danger"
                    confirmMessage="Smazat všechny vybrané docházkové logy?"
                  >
                    Smazat vybrané logy
                  </ConfirmSubmitButton>
                </div>
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Smazat</th>
                        <th>Člověk</th>
                        <th>Příchod</th>
                        <th>Odchod</th>
                        <th>Celkem</th>
                        <th>Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodRecords.map((record) => {
                        const user = userById.get(record.userId);
                        const inLocation = locationMap.get(record.clockInLocationId)?.name ?? record.clockInLocationId;
                        const outLocation = record.clockOutLocationId
                          ? (locationMap.get(record.clockOutLocationId)?.name ?? record.clockOutLocationId)
                          : inLocation;
                        return (
                          <tr key={record.id}>
                            <td data-label="Smazat">
                              <input type="checkbox" name="recordIds" value={record.id} />
                            </td>
                            <td data-label="Člověk">{user?.name ?? record.userId}</td>
                            <td data-label="Příchod">
                              <div className="stack gap-sm">
                                <p>{formatDateTime(record.clockInAt)}</p>
                                <p className="tiny subtle">{inLocation}</p>
                              </div>
                            </td>
                            <td data-label="Odchod">
                              <div className="stack gap-sm">
                                <p>{formatDateTime(record.clockOutAt)}</p>
                                <p className="tiny subtle">{record.clockOutAt ? outLocation : "otevřeno"}</p>
                              </div>
                            </td>
                            <td data-label="Celkem">{formatMinutes(minutesBetween(record.clockInAt, record.clockOutAt ?? new Date().toISOString()))}</td>
                            <td data-label="Akce">
                              <details className="stack">
                                <summary className="button ghost small summary-button">Upravit log</summary>
                                <form action={updateBaseAttendanceAction} className="stack gap-sm admin-inline-form">
                                  <input type="hidden" name="recordId" value={record.id} />
                                  <input type="hidden" name="redirectTo" value={redirectTo} />
                                  <label>
                                    Příchod
                                    <input type="datetime-local" name="clockInAt" defaultValue={formatDateTimeLocalValue(record.clockInAt)} required />
                                  </label>
                                  <label>
                                    Pobočka příchodu
                                    <select name="clockInLocationId" defaultValue={record.clockInLocationId}>
                                      {visibleBaseLocations.map((location) => (
                                        <option key={`${record.id}-in-${location.id}`} value={location.id}>
                                          {location.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    Odchod
                                    <input type="datetime-local" name="clockOutAt" defaultValue={formatDateTimeLocalValue(record.clockOutAt)} />
                                  </label>
                                  <label>
                                    Pobočka odchodu
                                    <select name="clockOutLocationId" defaultValue={record.clockOutLocationId ?? record.clockInLocationId}>
                                      {visibleBaseLocations.map((location) => (
                                        <option key={`${record.id}-out-${location.id}`} value={location.id}>
                                          {location.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <div className="row gap-sm wrap">
                                    <button type="submit" className="button ghost">Uložit úpravu</button>
                                  </div>
                                </form>
                              </details>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </form>
            ) : null}
          </details>
        </section>
          </>
        ) : null}
      </div>
    </WorkAppFrame>
  );
}
