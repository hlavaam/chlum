import { AppLink } from "@/components/app-link";
import { WorkAppFrame } from "@/components/work-app-frame";
import { WorkBaseAccessForm } from "@/components/work-base-access-form";
import { WorkBaseTerminal } from "@/components/work-base-terminal";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteBaseAttendanceAction, updateBaseAttendanceAction } from "@/lib/actions";
import { canUseWorkRole, isManagerRole } from "@/lib/auth/role-access";
import { getCurrentUser, hasWorkBaseAccess } from "@/lib/auth/session";
import { workPaths } from "@/lib/paths";
import { baseAttendanceService } from "@/lib/services/base-attendance";
import { getLocationsCached, getUsersCached } from "@/lib/services/cached-reads";
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

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "short",
    timeStyle: "short",
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
  const baseAccess = await hasWorkBaseAccess();

  if (!currentUser && !baseAccess) {
    return (
      <div className="login-page">
        <div className="login-card">
          <WorkBaseAccessForm />
        </div>
      </div>
    );
  }

  const range = readString(params?.range) === "month" ? "month" : "week";
  const anchorDate = readString(params?.date) || toDateKey(new Date());
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const rangeStart = range === "month" ? startOfMonth(anchor) : startOfWeek(anchor);
  const rangeEnd = range === "month" ? endOfMonth(anchor) : endOfWeek(anchor);
  const startDate = toDateKey(rangeStart);
  const endDate = toDateKey(rangeEnd);
  const prevAnchor = toDateKey(range === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1) : addDays(anchor, -7));
  const nextAnchor = toDateKey(range === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) : addDays(anchor, 7));

  const [locations, users, records, activeRecords] = await Promise.all([
    getLocationsCached(),
    getUsersCached(),
    baseAttendanceService.loadAll(),
    baseAttendanceService.active(),
  ]);

  const baseLocations = locations.filter((location) => {
    const normalized = `${location.code} ${location.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return normalized.includes("chlum") || normalized.includes("vysker");
  });

  const activeRecordByUserId = new Map(activeRecords.map((record) => [record.userId, record] as const));
  const workUsers = users
    .filter((user) => user.active && canUseWorkRole(user.role))
    .sort((a, b) => a.name.localeCompare(b.name))
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

  const userMap = new Map(workUsers.map((user) => [user.id, user]));
  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const nowIso = new Date().toISOString();
  const filteredRecords = records.filter((record) => {
    const day = record.clockInAt.slice(0, 10);
    return day >= startDate && day <= endDate;
  });

  const managerSummaries = workUsers
    .map((user) => {
      const userRecords = filteredRecords
        .filter((record) => record.userId === user.id)
        .sort((a, b) => (b.clockOutAt ?? b.clockInAt).localeCompare(a.clockOutAt ?? a.clockInAt));
      const totalMinutes = userRecords.reduce((sum, record) => {
        const endIso = record.clockOutAt ?? nowIso;
        return sum + minutesBetween(record.clockInAt, endIso);
      }, 0);
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

  const content = (
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
          Vyber základnu, zapiš příchod nebo odchod a případně použij QR z profilu brigádníka. Statistiky níže vidí jen manager a admin.
        </p>
      </section>

      <WorkBaseTerminal
        locations={baseLocations.map((location) => ({ id: location.id, name: location.name, code: location.code }))}
        users={workUsers}
        currentUser={currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null}
      />

      {currentUser && isManagerRole(currentUser.role) ? (
        <>
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
                                  {baseLocations.map((item) => (
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
                                  {baseLocations.map((item) => (
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
        </>
      ) : null}
    </div>
  );

  if (currentUser) {
    return <WorkAppFrame>{content}</WorkAppFrame>;
  }

  return <div className="login-page"><div className="login-card wide-login-card">{content}</div></div>;
}
