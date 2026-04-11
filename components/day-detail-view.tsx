import { notFound } from "next/navigation";

import { AppLink } from "@/components/app-link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { RoleRequirementFields } from "@/components/role-requirement-fields";
import { ShiftAssignmentButton } from "@/components/shift-assignment-button";
import { ShiftTypeBadge } from "@/components/ui";
import {
  createShiftAction,
  deleteShiftAction,
  removeAssignmentAction,
  updateAssignmentStatusAction,
  updateShiftAction,
} from "@/lib/actions";
import { canUseWorkRole, isManagerRole } from "@/lib/auth/role-access";
import { SHIFT_TYPES, STAFF_ROLES, staffRoleLabels, shiftTypeLabels } from "@/lib/constants";
import { staffPaths } from "@/lib/paths";
import { formatRoleRequirementTime } from "@/lib/role-requirements";
import { filterBaseLocations } from "@/lib/services/base-locations";
import { baseReservationsService } from "@/lib/services/base-reservations";
import { getDayDetailsCached, getEventsForDateCached, getLocationsCached } from "@/lib/services/cached-reads";
import { formatCzDate, formatTimeRange } from "@/lib/utils";
import type { UserRecord } from "@/types/models";

type DayDetailViewProps = {
  date: string;
  user: UserRecord;
  redirectTo: string;
  closeHref?: string;
  embedded?: boolean;
  selectedShiftId?: string | null;
  reservationMessage?: string | null;
  reservationError?: string | null;
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

function getAssignedCount(
  assignments: Array<{
    staffRole: (typeof STAFF_ROLES)[number];
    status: "confirmed" | "pending";
  }>,
  role: (typeof STAFF_ROLES)[number],
) {
  return assignments.filter((assignment) => assignment.staffRole === role && assignment.status === "confirmed").length;
}

function getDisplayRoles(
  shift: {
    requiredRoles: Array<{
      role: (typeof STAFF_ROLES)[number];
      count: number;
    }>;
  },
) {
  return shift.requiredRoles.length > 0
    ? shift.requiredRoles.filter((item) => item.count > 0)
    : STAFF_ROLES.map((role) => ({ role, count: 0 }));
}

function getRoleLabel(
  requirement: {
    role: (typeof STAFF_ROLES)[number];
    count: number;
    startTime?: string;
    endTime?: string;
  },
) {
  const timeLabel = formatRoleRequirementTime(requirement);
  return timeLabel ? `${staffRoleLabels[requirement.role]} ${timeLabel}` : staffRoleLabels[requirement.role];
}

export async function DayDetailView({
  date,
  user,
  redirectTo,
  closeHref,
  embedded = false,
  selectedShiftId = null,
  reservationMessage = null,
  reservationError = null,
}: DayDetailViewProps) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [details, locations, events, reservations] = await Promise.all([
    getDayDetailsCached(date),
    getLocationsCached(),
    getEventsForDateCached(date),
    isManagerRole(user.role) ? baseReservationsService.forDateRange(date, date) : Promise.resolve([]),
  ]);
  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const baseLocations = filterBaseLocations(locations);
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
                  <AppLink className="icon-button modal-close-button" href={closeHref} scroll={false} aria-label="Zavřít detail dne">
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

      {isManagerRole(user.role) ? (
        <section className="panel stack">
          <div className="row between wrap">
            <div>
              <h3>Rezervace dne</h3>
              <p className="subtle">Manager a admin tady vidi rezervace z modulu Zakladna pro stejny den.</p>
            </div>
            <span className={`badge ${reservations.length > 0 ? "warning" : "neutral"}`}>{reservations.length} rezervací</span>
          </div>
          {reservationMessage ? <p className="badge success">{reservationMessage}</p> : null}
          {reservationError ? <p className="alert">{reservationError}</p> : null}
          {reservations.length === 0 ? <p className="subtle">Na tenhle den zatím není žádná rezervace.</p> : null}
          {reservations.length > 0 ? (
            <div className="stack gap-sm">
              {[...reservations]
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((reservation) => (
                  <article key={reservation.id} className="base-reservation-list-item">
                    <div className="row between wrap gap-sm align-center">
                      <div className="stack gap-sm">
                        <p>
                          <strong>{reservation.time}</strong> • {reservation.partySize} osob • {locationMap.get(reservation.locationId)?.name ?? reservation.locationId}
                        </p>
                        <p className="tiny subtle">
                          {reservation.name ? reservation.name : "Bez jména"}
                          {reservation.notes ? ` • ${reservation.notes}` : ""}
                        </p>
                      </div>
                      <form action="/api/work/base/reservations/delete" method="post">
                        <input type="hidden" name="reservationId" value={reservation.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <button type="submit" className="button ghost danger small">
                          Smazat
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
            </div>
          ) : null}
          <details className="stack">
            <summary className="button ghost summary-button">Přidat rezervaci</summary>
            <form className="grid-form" action="/api/work/base/reservations" method="post">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="date" value={date} />
              <label>
                Pobočka
                <select name="locationId" defaultValue={baseLocations[0]?.id ?? ""} required>
                  {baseLocations.map((location) => (
                    <option key={`reservation-location-${location.id}`} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Čas
                <input type="time" name="time" defaultValue="18:00" required />
              </label>
              <label>
                Počet osob
                <input type="number" name="partySize" min={1} max={40} defaultValue={2} required />
              </label>
              <label>
                Jméno
                <input type="text" name="name" placeholder="Nepovinné" />
              </label>
              <label className="full">
                Poznámka
                <textarea name="notes" rows={3} placeholder="Nepovinné" />
              </label>
              <button className="button" type="submit">
                Uložit rezervaci
              </button>
            </form>
          </details>
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
              <RoleRequirementFields defaultStartTime="10:00" defaultEndTime="22:00" />
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

        {[...details]
          .sort((a, b) => {
            if (a.shift.id === selectedShiftId) return -1;
            if (b.shift.id === selectedShiftId) return 1;
            return `${a.shift.startTime}${a.shift.endTime}`.localeCompare(`${b.shift.startTime}${b.shift.endTime}`);
          })
          .map(({ shift, assignments, occupancy }) => {
          const myAssignment = assignments.find((a) => a.userId === user.id);
          const displayRoles = getDisplayRoles(shift);
          return (
            <article className={`panel stack ${selectedShiftId === shift.id ? "selected-shift-panel" : ""}`.trim()} key={shift.id} id={`shift-${shift.id}`}>
              <div className="row between wrap align-start">
                <div className="stack gap-sm">
                  <p className="row gap-sm align-center wrap">
                    <ShiftTypeBadge type={shift.type} />
                    <span className="shift-detail-time">{formatTimeRange(shift.startTime, shift.endTime)}</span>
                  </p>
                  <p className="subtle">
                    <strong>{locationMap.get(shift.locationId)?.name}</strong>
                  </p>
                  {shift.notes ? <p className="subtle">Poznámka: {shift.notes}</p> : null}
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
                    <>
                      <div className="chips">
                        {displayRoles.map((item) => (
                          <span key={`${shift.id}-filled-${item.role}`} className="plain-stat-chip">
                            {getRoleLabel(item)} {getAssignedCount(assignments, item.role)}/{item.count || 0}
                          </span>
                        ))}
                      </div>
                      <ShiftAssignmentButton shiftId={shift.id} action="unassign" className="button ghost">
                        Odhlásit se
                      </ShiftAssignmentButton>
                    </>
                  ) : (
                    displayRoles.map((item) => {
                      const confirmedCount = getAssignedCount(assignments, item.role);
                      const roleIsFull = item.count > 0 && confirmedCount >= item.count;

                      if (roleIsFull) {
                        return (
                          <span key={`${shift.id}-${item.role}`} className="plain-stat-chip">
                            {getRoleLabel(item)} {confirmedCount}/{item.count}
                          </span>
                        );
                      }

                      return (
                        <ShiftAssignmentButton
                          key={`${shift.id}-${item.role}`}
                          shiftId={shift.id}
                          action="signup"
                          staffRole={item.role}
                          className="button role-signup-button"
                        >
                          {getRoleLabel(item)} {item.count > 0 ? `${confirmedCount}/${item.count}` : ""}
                        </ShiftAssignmentButton>
                      );
                    })
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
                    <RoleRequirementFields
                      requiredRoles={shift.requiredRoles}
                      defaultStartTime={shift.startTime}
                      defaultEndTime={/^\d{2}:\d{2}$/.test(shift.endTime) ? shift.endTime : "22:00"}
                    />
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
                                <div className="row gap-sm wrap">
                                  {assignment.status === "pending" ? (
                                    <form action={updateAssignmentStatusAction} className="row gap-sm">
                                      <input type="hidden" name="assignmentId" value={assignment.id} />
                                      <input type="hidden" name="status" value="confirmed" />
                                      <input type="hidden" name="redirectTo" value={redirectTo} />
                                      <button type="submit" className="button small">
                                        Potvrdit
                                      </button>
                                    </form>
                                  ) : null}
                                  <form action={removeAssignmentAction} className="row gap-sm">
                                    <input type="hidden" name="assignmentId" value={assignment.id} />
                                    <input type="hidden" name="date" value={date} />
                                    <input type="hidden" name="redirectTo" value={redirectTo} />
                                    <button type="submit" className="button ghost danger animate-tap">
                                      Odebrat
                                    </button>
                                  </form>
                                </div>
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
