import { notFound } from "next/navigation";

import { AppLink } from "@/components/app-link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FlexibleEndTimeFields } from "@/components/flexible-end-time-fields";
import { ShiftAssignmentButton } from "@/components/shift-assignment-button";
import { ShiftTypeBadge } from "@/components/ui";
import {
  createShiftAction,
  deleteShiftAction,
  removeAssignmentAction,
  updateShiftAction,
} from "@/lib/actions";
import { canUseWorkRole, isManagerRole } from "@/lib/auth/role-access";
import { SHIFT_TYPES, STAFF_ROLES, staffRoleLabels, shiftTypeLabels } from "@/lib/constants";
import { staffPaths } from "@/lib/paths";
import { getDayDetailsCached, getEventsForDateCached, getLocationsCached } from "@/lib/services/cached-reads";
import { formatCzDate, formatTimeRange } from "@/lib/utils";
import type { UserRecord } from "@/types/models";

type DayDetailViewProps = {
  date: string;
  user: UserRecord;
  redirectTo: string;
  closeHref?: string;
  embedded?: boolean;
};

function getRequiredCount(
  shift: {
    requiredRoles: Array<{
      role: (typeof STAFF_ROLES)[number];
      count: number;
    }>;
  },
  role: (typeof STAFF_ROLES)[number],
) {
  return shift.requiredRoles.find((item) => item.role === role)?.count ?? 0;
}

export async function DayDetailView({ date, user, redirectTo, closeHref, embedded = false }: DayDetailViewProps) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [details, locations, events] = await Promise.all([
    getDayDetailsCached(date),
    getLocationsCached(),
    getEventsForDateCached(date),
  ]);
  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const dayEvents = events;
  const canManageAssignments = isManagerRole(user.role);
  const canManageShifts = canManageAssignments;
  const canSelfAssign = canUseWorkRole(user.role);

  return (
    <div className={`stack gap-lg ${embedded ? "day-detail-modal-body" : ""}`.trim()}>
      <section className={`panel ${embedded ? "day-detail-modal-header" : ""}`.trim()}>
        <div className="row between wrap">
          <div>
            {!embedded ? <p className="eyebrow">Detail dne</p> : null}
            <h2>{formatCzDate(date)}</h2>
          </div>
          <div className="row gap-sm">
            {embedded ? (
              <>
                {isManagerRole(user.role) ? (
                  <AppLink className="button ghost small" href={staffPaths.adminScheduleWithParams({ date })}>
                    Správa dne
                  </AppLink>
                ) : null}
                {closeHref ? (
                  <AppLink className="icon-button modal-close-button" href={closeHref} aria-label="Zavřít detail dne">
                    <span aria-hidden>×</span>
                  </AppLink>
                ) : null}
              </>
            ) : (
              <>
                <AppLink className="button ghost" href={staffPaths.employees}>
                  Zpět na kalendář
                </AppLink>
                {isManagerRole(user.role) ? (
                  <AppLink className="button" href={staffPaths.adminScheduleWithParams({ date })}>
                    Otevřít správu dne
                  </AppLink>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      {dayEvents.length > 0 ? (
        <section className="panel stack">
          <h3>Eventy dne</h3>
          {dayEvents.map((event) => (
            <div key={event.id} className="list-row">
              <div>
                <p>
                  <strong>{event.name}</strong> <ShiftTypeBadge type={event.type} />
                </p>
                <p className="subtle">
                  {formatTimeRange(event.startTime, event.endTime)} • {locationMap.get(event.locationId)?.name}
                </p>
                {event.notes ? <p className="subtle">{event.notes}</p> : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {canManageShifts ? (
        <section className="panel stack">
          <details className="stack">
            <summary className="button summary-button">Přidat směnu</summary>
            <form action={createShiftAction} className="grid-form">
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <label>
                Pobočka
                <select name="locationId" required defaultValue={locations[0]?.id ?? ""}>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Typ
                <select name="type" defaultValue="restaurant">
                  {SHIFT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {shiftTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Min. lidí
                <input type="number" min={0} name="minimumPeople" defaultValue={2} required />
              </label>
              {STAFF_ROLES.map((role) => (
                <label key={`new-shift-${role}`}>
                  {staffRoleLabels[role]} potřebujeme
                  <input type="number" min={0} name={`${role}Count`} defaultValue={0} />
                </label>
              ))}
              <label>
                Čas od
                <input type="time" name="startTime" defaultValue="10:00" />
              </label>
              <FlexibleEndTimeFields timeLabel="Čas do" defaultTime="22:00" />
              <label className="inline">
                <input type="checkbox" name="requiresApproval" />
                Vyžaduje schválení
              </label>
              <label className="full">
                Poznámka
                <textarea name="notes" rows={2} placeholder="Volitelné" />
              </label>
              <button className="button" type="submit">
                Přidat / uložit směnu
              </button>
            </form>
          </details>
        </section>
      ) : null}

      <section className="stack gap-md">
        {details.length === 0 ? (
          <div className="panel">
            <p>Na tento den nejsou zatím vypsané směny.</p>
          </div>
        ) : null}

        {details.map(({ shift, assignments, occupancy }) => {
          const myAssignment = assignments.find((a) => a.userId === user.id);
          return (
            <article className="panel stack" key={shift.id}>
              <div className="row between wrap">
                <div>
                  <p className="row gap-sm align-center">
                    <ShiftTypeBadge type={shift.type} />
                    <strong>{formatTimeRange(shift.startTime, shift.endTime)}</strong>
                    <span className="subtle">{locationMap.get(shift.locationId)?.name}</span>
                  </p>
                  {shift.notes ? <p className="subtle">Poznámka: {shift.notes}</p> : null}
                  {shift.requiredRoles.length > 0 ? (
                    <div className="chips">
                      {shift.requiredRoles.map((item) => (
                        <span key={`${shift.id}-${item.role}`} className="chip">
                          {staffRoleLabels[item.role]} {item.count}x
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="stack align-end">
                  <div className="metric">
                    <span>Obsazení</span>
                    <strong>
                      {occupancy.confirmed}/{shift.minimumPeople}
                      {occupancy.pending ? ` (+${occupancy.pending})` : ""}
                    </strong>
                  </div>
                  {shift.requiresApproval ? <span className="badge warning">Vyžaduje schválení</span> : null}
                </div>
              </div>

              <div className="row gap-sm wrap">
                {canSelfAssign ? (
                  myAssignment ? (
                    <ShiftAssignmentButton shiftId={shift.id} action="unassign" className="button ghost">
                      Odhlásit se
                    </ShiftAssignmentButton>
                  ) : (
                    <ShiftAssignmentButton shiftId={shift.id} action="signup" className="button">
                      Přihlásit se
                    </ShiftAssignmentButton>
                  )
                ) : null}
              </div>

              {canManageShifts ? (
                <details className="stack">
                  <summary className="button ghost summary-button">Upravit směnu</summary>
                  <form action={updateShiftAction} className="grid-form">
                    <input type="hidden" name="shiftId" value={shift.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <label>
                      Datum
                      <input type="date" name="date" defaultValue={shift.date} required />
                    </label>
                    <label>
                      Čas od
                      <input type="time" name="startTime" defaultValue={shift.startTime} required />
                    </label>
                    <FlexibleEndTimeFields
                      timeLabel="Čas do"
                      required
                      defaultTime={/^\d{2}:\d{2}$/.test(shift.endTime) ? shift.endTime : ""}
                      defaultFlexible={!/^\d{2}:\d{2}$/.test(shift.endTime)}
                    />
                    <label>
                      Pobočka
                      <select name="locationId" defaultValue={shift.locationId} required>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Typ
                      <select name="type" defaultValue={shift.type}>
                        {SHIFT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {shiftTypeLabels[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Min. lidí
                      <input type="number" min={0} name="minimumPeople" defaultValue={shift.minimumPeople} required />
                    </label>
                    {STAFF_ROLES.map((role) => (
                      <label key={`${shift.id}-${role}`}>
                        {staffRoleLabels[role]} potřebujeme
                        <input type="number" min={0} name={`${role}Count`} defaultValue={getRequiredCount(shift, role)} />
                      </label>
                    ))}
                    <label className="full">
                      Poznámka
                      <textarea name="notes" rows={2} defaultValue={shift.notes ?? ""} />
                    </label>
                    <label className="inline">
                      <input type="checkbox" name="requiresApproval" defaultChecked={shift.requiresApproval} />
                      Vyžaduje schválení
                    </label>
                    <button type="submit" className="button">
                      Uložit změny směny
                    </button>
                  </form>
                </details>
              ) : null}

              <div className="stack">
                {assignments.length === 0 ? (
                  <p className="subtle">Zatím nikdo.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Jméno</th>
                          <th>Role</th>
                          <th>Stav</th>
                          {canManageAssignments ? <th>Akce</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map((assignment) => (
                          <tr key={assignment.id}>
                            <td>{assignment.userName ?? assignment.userId}</td>
                            <td>{staffRoleLabels[assignment.staffRole] ?? assignment.staffRole}</td>
                            <td>
                              <span className={`badge ${assignment.status === "pending" ? "warning" : "success"}`}>
                                {assignment.status === "pending" ? "Čeká" : "Potvrzeno"}
                              </span>
                            </td>
                            {canManageAssignments ? (
                              <td>
                                <form action={removeAssignmentAction} className="row gap-sm">
                                  <input type="hidden" name="assignmentId" value={assignment.id} />
                                  <input type="hidden" name="date" value={date} />
                                  <input type="hidden" name="redirectTo" value={redirectTo} />
                                  <button type="submit" className="button ghost danger animate-tap">
                                    Odebrat
                                  </button>
                                </form>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {canManageShifts ? (
                <div className="row shift-delete-row">
                  <form action={deleteShiftAction}>
                    <input type="hidden" name="shiftId" value={shift.id} />
                    <input type="hidden" name="date" value={date} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <ConfirmSubmitButton
                      type="submit"
                      className="button ghost danger small"
                      confirmMessage="Smazat tuto směnu včetně přihlášek?"
                    >
                      Smazat směnu
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
