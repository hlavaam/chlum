import { AppLink } from "@/components/app-link";
import { DateMultiPicker } from "@/components/date-multi-picker";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FlexibleEndTimeFields } from "@/components/flexible-end-time-fields";
import { WorkAppFrame } from "@/components/work-app-frame";
import {
  createShiftAction,
  deleteShiftAction,
  manualAssignAction,
  toggleShiftApprovalAction,
  updateAssignmentStatusAction,
  updateShiftAction,
} from "@/lib/actions";
import { requireRoles } from "@/lib/auth/rbac";
import { SHIFT_TYPES, STAFF_ROLES, staffRoleLabels, shiftTypeLabels } from "@/lib/constants";
import { workPaths } from "@/lib/paths";
import { assignmentsService } from "@/lib/services/assignments";
import {
  getDayDetailsCached,
  getLocationsCached,
  getWeekRosterCached,
  getUsersCached,
} from "@/lib/services/cached-reads";
import type { DayShiftView } from "@/lib/services/schedule";
import { shiftsService } from "@/lib/services/shifts";
import { endOfWeek, formatCzDate, startOfWeek, toDateKey } from "@/lib/utils";
import type { AssignmentRecord, ShiftRecord, UserRecord } from "@/types/models";
import { WORK_SHIFT_PRESETS } from "@/lib/work-shift-presets";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getRequiredCount(shift: ShiftRecord, role: (typeof STAFF_ROLES)[number]) {
  return shift.requiredRoles.find((item) => item.role === role)?.count ?? 0;
}

async function WorkScheduleContent({ searchParams }: Props) {
  await requireRoles(["manager", "admin"], {
    loginPath: workPaths.login,
    fallbackPath: workPaths.schedule,
  });
  const params = await searchParams;
  const date = readString(params, "date") || toDateKey(new Date());
  const tab = readString(params, "tab") === "admin" ? "admin" : "calendar";
  const anchor = new Date(`${date}T00:00:00`);
  const weekStart = toDateKey(startOfWeek(anchor));
  const weekEnd = toDateKey(endOfWeek(anchor));
  const overviewStartAnchor = new Date(anchor);
  overviewStartAnchor.setDate(overviewStartAnchor.getDate() - 30);
  const overviewEndAnchor = new Date(anchor);
  overviewEndAnchor.setDate(overviewEndAnchor.getDate() + 120);
  const overviewStart = toDateKey(overviewStartAnchor);
  const overviewEnd = toDateKey(overviewEndAnchor);
  const locationsPromise = getLocationsCached();
  const weekRosterPromise = getWeekRosterCached(weekStart, weekEnd);
  const emptyAdminData: [DayShiftView[], UserRecord[], ShiftRecord[], AssignmentRecord[]] = [[], [], [], []];
  const adminDataPromise: Promise<[DayShiftView[], UserRecord[], ShiftRecord[], AssignmentRecord[]]> = tab === "admin"
    ? (async () => {
        const [dayDetails, users, shifts] = await Promise.all([
          getDayDetailsCached(date),
          getUsersCached(),
          shiftsService.forDateRange(overviewStart, overviewEnd),
        ]);
        const assignments = await assignmentsService.forShiftIds(shifts.map((shift) => shift.id));
        return [dayDetails, users, shifts, assignments];
      })()
    : Promise.resolve(emptyAdminData);
  const [locations, weekRoster, [dayDetails, users, shifts, assignments]] = await Promise.all([
    locationsPromise,
    weekRosterPromise,
    adminDataPromise,
  ]);
  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const pendingAssignments = assignments.filter((a) => a.status === "pending");

  return (
    <div className="stack gap-lg">
      <section className="panel stack">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Přehled týdne</p>
            <h2>{formatCzDate(weekStart)} až {formatCzDate(weekEnd)}</h2>
          </div>
          <p className="subtle tiny">Týdenní soupis brigádníků a provozu.</p>
        </div>
        <div className="calendar-grid week">
          {weekRoster.map((day) => (
            <article key={day.date} className="day-card">
              <div className="row between wrap">
                <strong>{formatCzDate(day.date)}</strong>
                <span className="badge neutral">
                  {day.totalConfirmed} potvrzeno{day.totalPending ? ` + ${day.totalPending} čeká` : ""}
                </span>
              </div>
              {day.locations.length === 0 ? (
                <p className="subtle tiny">Bez směn.</p>
              ) : (
                <div className="stack">
                  {day.locations.map((location) => (
                    <div key={`${day.date}-${location.locationId}`} className="day-location-row">
                      <div className="day-location-main">
                        <p className="day-location-title">
                          <strong>{location.locationName}</strong>
                        </p>
                        {location.shifts.map((shift) => (
                          <p key={shift.shiftId} className="subtle tiny">
                            <AppLink className="schedule-inline-link" href={workPaths.employeeDay(day.date, shift.shiftId)}>
                              {shift.startTime}–{shift.endTime} • {shiftTypeLabels[shift.type]}
                            </AppLink>
                          </p>
                        ))}
                        {location.roleAssignments.map((roleAssignment) => (
                          <p key={`${location.locationId}-${roleAssignment.role}`} className="tiny">
                            <strong>{staffRoleLabels[roleAssignment.role]}:</strong>{" "}
                            {roleAssignment.confirmedUsers.length > 0 ? roleAssignment.confirmedUsers.join(", ") : "nikdo"}
                            {roleAssignment.pendingUsers.length > 0 ? ` • čeká: ${roleAssignment.pendingUsers.join(", ")}` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Správa provozu</p>
            <h2>Provoz dne {date}</h2>
          </div>
          <div className="row gap-sm">
            <AppLink className="button ghost" href={workPaths.employeeDay(date)}>
              Náhled dne
            </AppLink>
            <a className="button" href="/api/admin/export/shifts">
              Export CSV
            </a>
          </div>
        </div>

        <div className="row gap-sm wrap">
          <AppLink
            className={`button ${tab === "calendar" ? "" : "ghost"}`}
            href={workPaths.scheduleWithParams({ tab: "calendar", date })}
          >
            Kalendář + Presety
          </AppLink>
          <AppLink
            className={`button ${tab === "admin" ? "" : "ghost"}`}
            href={workPaths.scheduleWithParams({ tab: "admin", date })}
          >
            Admin (obsazení)
          </AppLink>
        </div>
        {tab === "calendar" ? (
          <>
            <form action={createShiftAction} className="grid-form">
              <label>
                Datum
                <input type="date" name="dateFrom" defaultValue={date} required />
              </label>
              <label>
                Typ dne / provozu
                <select name="type" defaultValue="restaurant">
                  {SHIFT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {shiftTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preset
                <select name="preset" defaultValue="">
                  <option value="">Bez presetu</option>
                  {WORK_SHIFT_PRESETS.length === 0 ? <option value="" disabled>Presety zatím nejsou</option> : null}
                  {WORK_SHIFT_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pobočka
                <select name="locationId" required>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Čas od (volitelné, hodí se pro svatbu/event)
                <input type="time" name="startTime" />
              </label>
              <FlexibleEndTimeFields timeLabel="Čas do (volitelné)" />
              {STAFF_ROLES.map((role) => (
                <label key={`create-role-${role}`}>
                  {staffRoleLabels[role]} potřebujeme
                  <input type="number" min={0} name={`${role}Count`} defaultValue={0} />
                </label>
              ))}
              <details className="full stack">
                <summary className="subtle">Rozsah / opakování (volitelné)</summary>
                <div className="grid-form">
                  <label>
                    Do data
                    <input type="date" name="dateTo" defaultValue={date} required />
                  </label>
                  <fieldset className="full">
                    <legend>Dny v týdnu (pro rozsah)</legend>
                    <div className="checkbox-grid">
                      <label className="checkbox-pill">
                        <input type="checkbox" name="weekdays" value="mon" defaultChecked />
                        <span>Po</span>
                      </label>
                      <label className="checkbox-pill">
                        <input type="checkbox" name="weekdays" value="tue" defaultChecked />
                        <span>Út</span>
                      </label>
                      <label className="checkbox-pill">
                        <input type="checkbox" name="weekdays" value="wed" defaultChecked />
                        <span>St</span>
                      </label>
                      <label className="checkbox-pill">
                        <input type="checkbox" name="weekdays" value="thu" defaultChecked />
                        <span>Čt</span>
                      </label>
                      <label className="checkbox-pill">
                        <input type="checkbox" name="weekdays" value="fri" defaultChecked />
                        <span>Pá</span>
                      </label>
                      <label className="checkbox-pill">
                        <input type="checkbox" name="weekdays" value="sat" defaultChecked />
                        <span>So</span>
                      </label>
                      <label className="checkbox-pill">
                        <input type="checkbox" name="weekdays" value="sun" defaultChecked />
                        <span>Ne</span>
                      </label>
                    </div>
                  </fieldset>
                  <div className="full stack">
                    <label>
                      Konkrétní dny (volitelné)
                      <span className="subtle">
                        Naklikej libovolné dny. Když něco vybereš, použije se to místo rozsahu.
                      </span>
                    </label>
                    <DateMultiPicker name="customDates" initialDate={date} />
                  </div>
                </div>
              </details>
              <label className="full">
                Poznámka (např. „otevřeno jen do 4“)
                <textarea name="notes" rows={2} placeholder="Volitelné" />
              </label>
              <label className="inline">
                <input type="checkbox" name="requiresApproval" />
                Vyžaduje schválení
              </label>
              <button type="submit" className="button">
                Uložit provoz / dny
              </button>
            </form>
          </>
        ) : null}
      </section>

      {tab === "admin" ? (
        <>
          <section className="panel stack">
            <h3>Detail dne</h3>
            {dayDetails.length === 0 ? <p className="subtle">Žádný vypsaný provoz.</p> : null}
            {dayDetails.map((detail) => (
              <div className="panel subtle-panel stack" key={detail.shift.id}>
                <div className="row between wrap">
                  <div>
                    <p>
                      <strong>
                        {detail.shift.startTime}–{detail.shift.endTime}
                      </strong>{" "}
                      • {locationMap.get(detail.shift.locationId)?.name} • {shiftTypeLabels[detail.shift.type]}
                    </p>
                    <p className="tiny">
                      <AppLink className="schedule-inline-link" href={workPaths.employeeDay(detail.shift.date, detail.shift.id)}>
                        Otevřít detail směny
                      </AppLink>
                    </p>
                    {detail.shift.notes ? <p className="subtle">Poznámka: {detail.shift.notes}</p> : null}
                    <p className="subtle">
                      Obsazení: {detail.occupancy.confirmed}/{detail.shift.minimumPeople}
                      {detail.occupancy.pending ? ` (+${detail.occupancy.pending} čeká)` : ""}
                    </p>
                    {detail.shift.requiredRoles.length > 0 ? (
                      <div className="chips">
                        {detail.shift.requiredRoles.map((item) => (
                          <span key={`${detail.shift.id}-${item.role}`} className="chip">
                            {staffRoleLabels[item.role]} {item.count}x
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <form action={toggleShiftApprovalAction}>
                    <input type="hidden" name="shiftId" value={detail.shift.id} />
                    <button type="submit" className="button ghost">
                      {detail.shift.requiresApproval ? "Schvalování zapnuto" : "Schvalování vypnuto"}
                    </button>
                  </form>
                </div>

                <form action={manualAssignAction} className="row gap-sm wrap admin-inline-form">
                  <input type="hidden" name="shiftId" value={detail.shift.id} />
                  <select name="userId" required defaultValue="">
                    <option value="" disabled>
                      Přidat brigádníka
                    </option>
                    {users
                      .filter((u) => u.active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                  <select name="staffRole" defaultValue={detail.shift.requiredRoles[0]?.role ?? "plac"}>
                    {STAFF_ROLES.map((role) => (
                      <option key={`${detail.shift.id}-${role}`} value={role}>
                        {staffRoleLabels[role]}
                      </option>
                    ))}
                  </select>
                  <button className="button" type="submit">
                    Ručně přidat
                  </button>
                </form>

                <details className="stack">
                  <summary className="subtle">Upravit / smazat směnu</summary>
                  <form action={updateShiftAction} className="grid-form">
                    <input type="hidden" name="shiftId" value={detail.shift.id} />
                    <input type="hidden" name="redirectTo" value={workPaths.scheduleWithParams({ tab: "admin", date })} />
                    <label>
                      Datum
                      <input type="date" name="date" defaultValue={detail.shift.date} required />
                    </label>
                    <label>
                      Čas od
                      <input type="time" name="startTime" defaultValue={detail.shift.startTime} required />
                    </label>
                    <FlexibleEndTimeFields
                      timeLabel="Čas do"
                      required
                      defaultTime={/^\d{2}:\d{2}$/.test(detail.shift.endTime) ? detail.shift.endTime : ""}
                      defaultFlexible={!/^\d{2}:\d{2}$/.test(detail.shift.endTime)}
                    />
                    <label>
                      Pobočka
                      <select name="locationId" defaultValue={detail.shift.locationId} required>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Typ
                      <select name="type" defaultValue={detail.shift.type}>
                        {SHIFT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {shiftTypeLabels[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {STAFF_ROLES.map((role) => (
                      <label key={`${detail.shift.id}-${role}`}>
                        {staffRoleLabels[role]} potřebujeme
                        <input
                          type="number"
                          min={0}
                          name={`${role}Count`}
                          defaultValue={getRequiredCount(detail.shift, role)}
                        />
                      </label>
                    ))}
                    <label className="full">
                      Poznámka
                      <textarea name="notes" rows={2} defaultValue={detail.shift.notes ?? ""} />
                    </label>
                    <label className="inline">
                      <input type="checkbox" name="requiresApproval" defaultChecked={detail.shift.requiresApproval} />
                      Vyžaduje schválení
                    </label>
                    <div className="row gap-sm wrap full">
                      <button type="submit" className="button">
                        Uložit změny směny
                      </button>
                    </div>
                  </form>

                  <form action={deleteShiftAction} className="row gap-sm wrap">
                    <input type="hidden" name="shiftId" value={detail.shift.id} />
                    <input type="hidden" name="date" value={detail.shift.date} />
                    <input type="hidden" name="redirectTo" value={workPaths.scheduleWithParams({ tab: "admin", date })} />
                    <ConfirmSubmitButton
                      type="submit"
                      className="button ghost danger"
                      confirmMessage="Smazat tuto směnu včetně všech přihlášek brigádníků?"
                    >
                      Smazat směnu (vč. přihlášek)
                    </ConfirmSubmitButton>
                  </form>
                </details>

                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Jméno</th>
                        <th>Role na směně</th>
                        <th>Stav</th>
                        <th>Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.assignments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="subtle" data-label="">
                            Zatím nikdo přihlášen.
                          </td>
                        </tr>
                      ) : (
                        detail.assignments.map((assignment) => (
                          <tr key={assignment.id}>
                            <td data-label="Jméno">{assignment.userName ?? assignment.userId}</td>
                            <td data-label="Role na směně">{staffRoleLabels[assignment.staffRole] ?? assignment.staffRole}</td>
                            <td data-label="Stav">{assignment.status === "pending" ? "Čeká" : "Potvrzeno"}</td>
                            <td data-label="Akce">
                              <form action={updateAssignmentStatusAction} className="row gap-sm wrap admin-inline-form">
                                <input type="hidden" name="assignmentId" value={assignment.id} />
                                <input type="hidden" name="redirectTo" value={workPaths.scheduleWithParams({ tab: "admin", date })} />
                                <select name="status" defaultValue={assignment.status}>
                                  <option value="pending">Čeká</option>
                                  <option value="confirmed">Potvrzeno</option>
                                </select>
                                <button type="submit" className="button ghost">
                                  Uložit
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          <section className="panel stack">
            <h3>Přehled období</h3>
            <p className="subtle">
              Zobrazeno od {overviewStart} do {overviewEnd}, aby správa zůstala rychlá i při větším počtu směn.
            </p>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Čas</th>
                    <th>Pobočka</th>
                    <th>Typ</th>
                    <th>Min</th>
                    <th>Role mix</th>
                    <th>Approval</th>
                    <th>Poznámka</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts
                    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
                    .map((shift) => (
                      <tr key={shift.id}>
                        <td data-label="Datum">{shift.date}</td>
                        <td data-label="Čas">
                          {shift.startTime}–{shift.endTime}
                        </td>
                        <td data-label="Pobočka">{locationMap.get(shift.locationId)?.code}</td>
                        <td data-label="Typ">{shiftTypeLabels[shift.type]}</td>
                        <td data-label="Min">{shift.minimumPeople}</td>
                        <td data-label="Role mix">
                          {shift.requiredRoles.length > 0
                            ? shift.requiredRoles.map((item) => `${staffRoleLabels[item.role]} ${item.count}x`).join(", ")
                            : "volné"}
                        </td>
                        <td data-label="Approval">{shift.requiresApproval ? "ano" : "ne"}</td>
                        <td data-label="Poznámka">{shift.notes ?? ""}</td>
                        <td data-label="Akce">
                          <div className="stack gap-sm">
                            <AppLink className="button ghost small" href={workPaths.employeeDay(shift.date, shift.id)}>
                              Detail
                            </AppLink>
                            <form action={deleteShiftAction} className="row wrap admin-inline-form">
                              <input type="hidden" name="shiftId" value={shift.id} />
                              <input type="hidden" name="date" value={shift.date} />
                              <input type="hidden" name="redirectTo" value={workPaths.scheduleWithParams({ tab: "admin", date })} />
                              <ConfirmSubmitButton
                                type="submit"
                                className="button ghost danger small"
                                confirmMessage="Smazat tuto směnu včetně přihlášek?"
                              >
                                Smazat
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {pendingAssignments.length > 0 ? <p className="subtle">Čekající přihlášky: {pendingAssignments.length}</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function WorkSchedulePage(props: Props) {
  return (
    <WorkAppFrame>
      <WorkScheduleContent {...props} />
    </WorkAppFrame>
  );
}
