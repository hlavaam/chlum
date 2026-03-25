import { redirect } from "next/navigation";

import { WorkAppFrame } from "@/components/work-app-frame";
import { WorkBaseAccessForm } from "@/components/work-base-access-form";
import { WorkBaseTerminal } from "@/components/work-base-terminal";
import { logoutAction } from "@/lib/actions";
import { canUseBaseTerminalRole, isBaseRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { workPaths } from "@/lib/paths";
import { baseAttendanceService } from "@/lib/services/base-attendance";
import { getDayDetailsCached, getLocationsCached, getUsersCached } from "@/lib/services/cached-reads";
import {
  toDateKey,
} from "@/lib/utils";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function WorkBasePage({ searchParams }: Props) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();
  const error = readString(params?.error) === "1";

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

  const [locations, users, records, activeRecords, todayDetails] = await Promise.all([
    getLocationsCached(),
    getUsersCached(),
    baseAttendanceService.loadAll(),
    baseAttendanceService.active(),
    getDayDetailsCached(todayDate),
  ]);

  const baseLocations = locations.filter((location) => {
    const normalized = `${location.code} ${location.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return normalized.includes("chlum") || normalized.includes("vysker");
  });

  const allowedLocationIds = isBaseRole(currentUser.role) ? new Set(currentUser.locationIds) : null;
  const visibleBaseLocations = isBaseRole(currentUser.role)
    ? baseLocations.filter((location) => allowedLocationIds?.has(location.id))
    : baseLocations;

  const activeRecordByUserId = new Map(activeRecords.map((record) => [record.userId, record] as const));
  const locationMap = new Map(locations.map((location) => [location.id, location]));
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
      photoDataUrl: user.photoDataUrl,
      activeRecord: activeRecordByUserId.get(user.id)
        ? {
            clockInAt: activeRecordByUserId.get(user.id)?.clockInAt ?? "",
            locationId: activeRecordByUserId.get(user.id)?.clockInLocationId ?? "",
          }
        : null,
    }));
  const terminal = (
    <WorkBaseTerminal
      locations={visibleBaseLocations.map((location) => ({ id: location.id, name: location.name, code: location.code }))}
      users={terminalUsers}
      rosterByLocation={Object.fromEntries(
        visibleBaseLocations.map((location) => [location.id, rosterByLocation.get(location.id) ?? []]),
      )}
      lockSingleLocation={visibleBaseLocations.length <= 1}
      compactMode={isBaseRole(currentUser.role)}
    />
  );

  const todayLocationOverview = visibleBaseLocations
    .map((location) => ({
      location,
      entries: rosterByLocation.get(location.id) ?? [],
    }))
    .filter((entry) => entry.entries.length > 0);

  if (isBaseRole(currentUser.role)) {
    return (
      <div className="login-page base-kiosk-page">
        <div className="login-card wide-login-card stack gap-lg base-kiosk-card">
          <section className="panel base-topbar-panel">
            <div className="row between align-center wrap gap-sm">
              <h1 className="base-kiosk-title">Základna</h1>
              <form action={logoutAction}>
                <button type="submit" className="button ghost small">Odhlásit</button>
              </form>
            </div>
          </section>
          {visibleBaseLocations.length === 0 ? <p className="alert">Tomuhle účtu Základna zatím není přiřazená žádná pobočka.</p> : null}
          {terminal}
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
              <p className="eyebrow">Docházka</p>
              <h1>Základna</h1>
            </div>
            <span className={`badge ${activeRecords.length > 0 ? "warning" : "neutral"}`}>
              Teď na základně: {activeRecords.length}
            </span>
          </div>
          <p className="subtle">
            Přihlášené účty Základna vidí jen kioskovou obrazovku. Tady jako manager nebo admin vidíš i přehledy a ruční opravy.
          </p>
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
      </div>
    </WorkAppFrame>
  );
}
