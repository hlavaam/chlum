import { redirect } from "next/navigation";

import { AppLink } from "@/components/app-link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { WorkAppFrame } from "@/components/work-app-frame";
import { WorkBaseAccessForm } from "@/components/work-base-access-form";
import { WorkBaseTerminal } from "@/components/work-base-terminal";
import { deleteBaseAttendanceAction, logoutAction, updateBaseAttendanceAction } from "@/lib/actions";
import { canUseBaseTerminalRole, isBaseRole, isManagerRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { staffRoleLabels } from "@/lib/constants";
import { workPaths } from "@/lib/paths";
import { baseAttendanceService } from "@/lib/services/base-attendance";
import { getDayDetailsCached, getLocationsCached, getUsersCached } from "@/lib/services/cached-reads";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatCzDate,
  formatMinutes,
  minutesBetween,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "@/lib/utils";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function toDateTimeLocalValue(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  const range = readString(params?.range) === "month" ? "month" : "week";
  const anchorDate = readString(params?.date) || toDateKey(new Date());
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const todayDate = toDateKey(new Date());
  const rangeStart = range === "month" ? startOfMonth(anchor) : startOfWeek(anchor);
  const rangeEnd = range === "month" ? endOfMonth(anchor) : endOfWeek(anchor);
  const startDate = toDateKey(rangeStart);
  const endDate = toDateKey(rangeEnd);
  const prevAnchor = toDateKey(range === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1) : addDays(anchor, -7));
  const nextAnchor = toDateKey(range === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) : addDays(anchor, 7));

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

  const allowedLocationIds = isBaseRole(currentUser.role) && currentUser.locationIds.length > 0
    ? new Set(currentUser.locationIds)
    : null;
  const visibleBaseLocations = allowedLocationIds
    ? baseLocations.filter((location) => allowedLocationIds.has(location.id))
    : baseLocations;

  const activeRecordByUserId = new Map(activeRecords.map((record) => [record.userId, record] as const));
  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const rosterByLocation = new Map<
    string,
    Array<{
      userId: string;
      name: string;
      staffRole: string;
      status: string;
      shiftId: string;
      timeLabel: string;
    }>
  >();

  for (const detail of todayDetails) {
    if (allowedLocationIds && !allowedLocationIds.has(detail.shift.locationId)) continue;
    const list = rosterByLocation.get(detail.shift.locationId) ?? [];
    for (const assignment of detail.assignments) {
      const user = userById.get(assignment.userId);
      if (!user) continue;
      list.push({
        userId: user.id,
        name: user.name,
        staffRole: staffRoleLabels[assignment.staffRole] ?? assignment.staffRole,
        status: assignment.status,
        shiftId: detail.shift.id,
        timeLabel: `${detail.shift.startTime}–${detail.shift.endTime}`,
      });
    }
    rosterByLocation.set(detail.shift.locationId, list);
  }

  const rosterUserIds = new Set<string>();
  for (const entries of rosterByLocation.values()) {
    for (const entry of entries) rosterUserIds.add(entry.userId);
  }
  for (const record of activeRecords) {
    rosterUserIds.add(record.userId);
  }

  const brigadnici = users
    .filter((user) => user.active && user.role === "brigadnik")
    .sort((a, b) => a.name.localeCompare(b.name));

  const terminalUsers = brigadnici
    .filter((user) => rosterUserIds.has(user.id))
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

  const nowIso = new Date().toISOString();
  const filteredRecords = records.filter((record) => {
    const day = record.clockInAt.slice(0, 10);
    if (day < startDate || day > endDate) return false;
    if (!allowedLocationIds) return true;
    return allowedLocationIds.has(record.clockInLocationId) || (record.clockOutLocationId ? allowedLocationIds.has(record.clockOutLocationId) : false);
  });

  const attendanceUsers = brigadnici
    .filter((user) => {
      if (filteredRecords.some((record) => record.userId === user.id)) return true;
      return activeRecordByUserId.has(user.id);
    })
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

  const userMap = new Map(attendanceUsers.map((user) => [user.id, user]));

  const managerSummaries = attendanceUsers
    .map((user) => {
      const userRecords = filteredRecords
        .filter((record) => record.userId === user.id)
        .sort((a, b) => (b.clockOutAt ?? b.clockInAt).localeCompare(a.clockOutAt ?? a.clockInAt));
      const totalMinutes = userRecords.reduce((sum, record) => sum + minutesBetween(record.clockInAt, record.clockOutAt ?? nowIso), 0);
      return {
        user,
        totalMinutes,
        latestRecord: userRecords[0] ?? null,
        activeRecord: activeRecordByUserId.get(user.id) ?? null,
      };
    })
    .filter((entry) => entry.totalMinutes > 0 || entry.activeRecord)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const historyRecords = [...filteredRecords]
    .sort((a, b) => (b.clockOutAt ?? b.clockInAt).localeCompare(a.clockOutAt ?? a.clockInAt))
    .slice(0, 60);

  const filterLabel =
    range === "month"
      ? new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(anchor)
      : `${formatCzDate(startDate)} až ${formatCzDate(endDate)}`;

  const terminal = (
    <WorkBaseTerminal
      locations={visibleBaseLocations.map((location) => ({ id: location.id, name: location.name, code: location.code }))}
      users={terminalUsers}
      rosterByLocation={Object.fromEntries(
        visibleBaseLocations.map((location) => [location.id, rosterByLocation.get(location.id) ?? []]),
      )}
      lockSingleLocation={isBaseRole(currentUser.role)}
    />
  );

  if (isBaseRole(currentUser.role)) {
    return (
      <div className="login-page">
        <div className="login-card wide-login-card stack gap-lg">
          <section className="panel stack">
            <div className="row between wrap">
              <div>
                <p className="eyebrow">Základna</p>
                <h1>Píchačka pro dnešní provoz</h1>
              </div>
              <form action={logoutAction}>
                <button type="submit" className="button ghost small">Odhlásit</button>
              </form>
            </div>
            <p className="subtle">
              Přihlášený účet: <strong>{currentUser.name}</strong>. Vidíš jen dnešní brigádníky pro svoje pobočky.
            </p>
          </section>
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
              <p className="eyebrow">Přehled docházky</p>
              <h2>{range === "month" ? "Měsíční souhrn" : "Týdenní souhrn"}</h2>
            </div>
            <span className="badge neutral">{filterLabel}</span>
          </div>
          <div className="row gap-sm wrap">
            <AppLink className={`button small ${range === "week" ? "" : "ghost"}`} href={workPaths.baseWithParams({ range: "week", date: anchorDate })}>
              Týden
            </AppLink>
            <AppLink className={`button small ${range === "month" ? "" : "ghost"}`} href={workPaths.baseWithParams({ range: "month", date: anchorDate })}>
              Měsíc
            </AppLink>
            <AppLink className="button ghost small" href={workPaths.baseWithParams({ range, date: prevAnchor })}>
              Předchozí
            </AppLink>
            <AppLink className="button ghost small" href={workPaths.baseWithParams({ range, date: toDateKey(new Date()) })}>
              Dnes
            </AppLink>
            <AppLink className="button ghost small" href={workPaths.baseWithParams({ range, date: nextAnchor })}>
              Další
            </AppLink>
          </div>
        </section>

        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Aktuálně na základně</p>
              <h2>Živé příchody</h2>
            </div>
            <span className="badge neutral">{activeRecords.length} otevřených docházek</span>
          </div>
          {activeRecords.length === 0 ? <p className="subtle">Teď není nikdo píchnutý.</p> : null}
          <div className="grid-2">
            {activeRecords.map((record) => {
              const user = userMap.get(record.userId);
              const location = locationMap.get(record.clockInLocationId);
              if (!user) return null;
              return (
                <article key={record.id} className="base-stat-card stack gap-sm">
                  <p><strong>{user.name}</strong></p>
                  <p className="subtle">{location?.name ?? record.clockInLocationId}</p>
                  <p className="tiny">Příchod: {formatTime(record.clockInAt)}</p>
                  <p className="tiny">Zatím: {formatMinutes(minutesBetween(record.clockInAt, nowIso))}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Souhrn</p>
              <h2>Odpracované hodiny</h2>
            </div>
            <span className="badge neutral">{managerSummaries.length} lidí v přehledu</span>
          </div>
          {managerSummaries.length === 0 ? <p className="subtle">V tomhle rozsahu zatím nejsou žádné záznamy.</p> : null}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Jméno</th>
                  <th>Teď</th>
                  <th>Celkem</th>
                  <th>Poslední příchod</th>
                  <th>Poslední odchod</th>
                </tr>
              </thead>
              <tbody>
                {managerSummaries.map((entry) => (
                  <tr key={entry.user.id}>
                    <td data-label="Jméno">{entry.user.name}</td>
                    <td data-label="Teď">{entry.activeRecord ? "Na základně" : "Mimo"}</td>
                    <td data-label="Celkem">{formatMinutes(entry.totalMinutes)}</td>
                    <td data-label="Poslední příchod">{entry.latestRecord ? formatDateTime(entry.latestRecord.clockInAt) : "—"}</td>
                    <td data-label="Poslední odchod">{entry.latestRecord?.clockOutAt ? formatDateTime(entry.latestRecord.clockOutAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Historie</p>
              <h2>Ruční opravy docházky</h2>
            </div>
            <span className="badge neutral">{historyRecords.length} záznamů</span>
          </div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Jméno</th>
                  <th>Základna</th>
                  <th>Příchod</th>
                  <th>Odchod</th>
                  <th>Hodiny</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {historyRecords.map((record) => {
                  const user = userMap.get(record.userId);
                  if (!user) return null;
                  const location = locationMap.get(record.clockInLocationId);
                  return (
                    <tr key={record.id}>
                      <td data-label="Jméno">{user.name}</td>
                      <td data-label="Základna">{location?.name ?? record.clockInLocationId}</td>
                      <td data-label="Příchod">{formatDateTime(record.clockInAt)}</td>
                      <td data-label="Odchod">{record.clockOutAt ? formatDateTime(record.clockOutAt) : "Otevřeno"}</td>
                      <td data-label="Hodiny">{formatMinutes(minutesBetween(record.clockInAt, record.clockOutAt ?? nowIso))}</td>
                      <td data-label="Akce">
                        <details className="stack">
                          <summary className="button ghost small summary-button">Upravit</summary>
                          <form action={updateBaseAttendanceAction} className="grid-form compact-grid-form">
                            <input type="hidden" name="recordId" value={record.id} />
                            <input type="hidden" name="redirectTo" value={workPaths.baseWithParams({ range, date: anchorDate })} />
                            <label>
                              Příchod
                              <input type="datetime-local" name="clockInAt" defaultValue={toDateTimeLocalValue(record.clockInAt)} required />
                            </label>
                            <label>
                              Základna příchodu
                              <select name="clockInLocationId" defaultValue={record.clockInLocationId}>
                                {visibleBaseLocations.map((item) => (
                                  <option key={`${record.id}-${item.id}-in`} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Odchod
                              <input type="datetime-local" name="clockOutAt" defaultValue={toDateTimeLocalValue(record.clockOutAt)} />
                            </label>
                            <label>
                              Základna odchodu
                              <select name="clockOutLocationId" defaultValue={record.clockOutLocationId ?? record.clockInLocationId}>
                                {visibleBaseLocations.map((item) => (
                                  <option key={`${record.id}-${item.id}-out`} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button type="submit" className="button small">
                              Uložit změny
                            </button>
                          </form>
                          <form action={deleteBaseAttendanceAction}>
                            <input type="hidden" name="recordId" value={record.id} />
                            <input type="hidden" name="redirectTo" value={workPaths.baseWithParams({ range, date: anchorDate })} />
                            <ConfirmSubmitButton
                              type="submit"
                              className="button ghost danger small"
                              confirmMessage={`Smazat docházku ${user.name}?`}
                            >
                              Smazat záznam
                            </ConfirmSubmitButton>
                          </form>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </WorkAppFrame>
  );
}
