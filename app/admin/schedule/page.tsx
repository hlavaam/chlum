import { AppLink } from "@/components/app-link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DateMultiPicker } from "@/components/date-multi-picker";
import { FlexibleEndTimeFields } from "@/components/flexible-end-time-fields";
import {
  createShiftAction,
  deleteShiftAction,
  manualAssignAction,
  toggleShiftApprovalAction,
  updateAssignmentStatusAction,
  updateShiftAction,
} from "@/lib/actions";
import { requireRoles } from "@/lib/auth/rbac";
import { SHIFT_TYPES, shiftTypeLabels } from "@/lib/constants";
import { assignmentsService } from "@/lib/services/assignments";
import { getDayDetailsCached, getLocationsCached, getUsersCached } from "@/lib/services/cached-reads";
import { shiftsService } from "@/lib/services/shifts";
import { toDateKey } from "@/lib/utils";
import type { AssignmentRecord, ShiftRecord, UserRecord } from "@/types/models";
import type { DayShiftView } from "@/lib/services/schedule";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSchedulePage({ searchParams }: Props) {
  await requireRoles(["manager", "admin"]);
  const params = await searchParams;
  const date = readString(params, "date") || toDateKey(new Date());
  const tab = readString(params, "tab") === "admin" ? "admin" : "calendar";
  const locationsPromise = getLocationsCached();
  const emptyAdminData: [DayShiftView[], UserRecord[], ShiftRecord[], AssignmentRecord[]] = [[], [], [], []];
  const adminDataPromise: Promise<[DayShiftView[], UserRecord[], ShiftRecord[], AssignmentRecord[]]> = tab === "admin"
    ? Promise.all([
        getDayDetailsCached(date),
        getUsersCached(),
        shiftsService.loadAll(),
        assignmentsService.loadAll(),
      ])
    : Promise.resolve(emptyAdminData);
  const [locations, [dayDetails, users, shifts, assignments]] = await Promise.all([
    locationsPromise,
    adminDataPromise,
  ]);
  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const pendingAssignments = assignments.filter((a) => a.status === "pending");

  return (
    <div className="stack gap-lg">
      <section className="panel stack">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Správa provozu</p>
            <h2>Provoz dne {date}</h2>
          </div>
          <div className="row gap-sm">
            <AppLink className="button ghost" href={`/employees/day/${date}`}>
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
            href={`/admin/schedule?tab=calendar&date=${date}`}
          >
            Kalendář + Presety
          </AppLink>
          <AppLink
            className={`button ${tab === "admin" ? "" : "ghost"}`}
            href={`/admin/schedule?tab=admin&date=${date}`}
          >
            Admin (obsazení)
          </AppLink>
        </div>
        {tab === "calendar" ? <form action={createShiftAction} className="grid-form">
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
              <option value="restaurant_to_16">Restaurace do 16</option>
              <option value="restaurant_full">Restaurace standard</option>
              <option value="wedding_day">Svatba</option>
              <option value="event_evening">Akce večer</option>
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
          <label>
            Min. lidí
            <input type="number" min={0} name="minimumPeople" defaultValue={3} required />
          </label>
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
        </form> : null}
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
                    {detail.shift.notes ? <p className="subtle">Poznámka: {detail.shift.notes}</p> : null}
                    <p className="subtle">
                      Obsazení: {detail.occupancy.confirmed}/{detail.shift.minimumPeople}
                      {detail.occupancy.pending ? ` (+${detail.occupancy.pending} čeká)` : ""}
                    </p>
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
                  <button className="button" type="submit">
                    Ručně přidat
                  </button>
                </form>

                <details className="stack">
                  <summary className="subtle">Upravit / smazat směnu</summary>
                  <form action={updateShiftAction} className="grid-form">
                    <input type="hidden" name="shiftId" value={detail.shift.id} />
                    <input type="hidden" name="redirectTo" value={`/admin/schedule?tab=admin&date=${date}`} />
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
                    <label>
                      Min. lidí
                      <input type="number" min={0} name="minimumPeople" defaultValue={detail.shift.minimumPeople} required />
                    </label>
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
                    <input type="hidden" name="redirectTo" value={`/admin/schedule?tab=admin&date=${date}`} />
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
                        <th>Stav</th>
                        <th>Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.assignments.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="subtle" data-label="">
                            Zatím nikdo přihlášen.
                          </td>
                        </tr>
                      ) : (
                        detail.assignments.map((assignment) => (
                          <tr key={assignment.id}>
                            <td data-label="Jméno">{assignment.userName ?? assignment.userId}</td>
                            <td data-label="Stav">{assignment.status === "pending" ? "Čeká" : "Potvrzeno"}</td>
                            <td data-label="Akce">
                              <form action={updateAssignmentStatusAction} className="row gap-sm wrap admin-inline-form">
                                <input type="hidden" name="assignmentId" value={assignment.id} />
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
            <h3>Všechny dny (rychlý přehled)</h3>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Čas</th>
                    <th>Pobočka</th>
                    <th>Typ</th>
                    <th>Min</th>
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
                        <td data-label="Approval">{shift.requiresApproval ? "ano" : "ne"}</td>
                        <td data-label="Poznámka">{shift.notes ?? ""}</td>
                        <td data-label="Akce">
                          <form action={deleteShiftAction} className="row wrap admin-inline-form">
                            <input type="hidden" name="shiftId" value={shift.id} />
                            <input type="hidden" name="date" value={shift.date} />
                            <input type="hidden" name="redirectTo" value={`/admin/schedule?tab=admin&date=${date}`} />
                            <ConfirmSubmitButton
                              type="submit"
                              className="button ghost danger small"
                              confirmMessage="Smazat tuto směnu včetně přihlášek?"
                            >
                              Smazat
                            </ConfirmSubmitButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {pendingAssignments.length > 0 ? (
              <p className="subtle">Čekající přihlášky: {pendingAssignments.length}</p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
