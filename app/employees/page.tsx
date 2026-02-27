import Link from "next/link";

import { ShiftAssignmentButton } from "@/components/shift-assignment-button";
import { requireUser } from "@/lib/auth/rbac";
import { shiftTypeLabels } from "@/lib/constants";
import { scheduleService } from "@/lib/services/schedule";
import { assignmentsService } from "@/lib/services/assignments";
import { addDays, getMonthGrid, getWeekDays, parseDateKey, startOfMonth, toDateKey } from "@/lib/utils";
import type { EventType, ShiftType } from "@/types/models";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function toAsciiLower(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

const LOCATION_CHIP_COLORS = [
  { bg: "rgba(33, 129, 108, 0.16)", border: "rgba(33, 129, 108, 0.35)", text: "#12584a" },
  { bg: "rgba(224, 122, 95, 0.16)", border: "rgba(224, 122, 95, 0.35)", text: "#8a3f2b" },
  { bg: "rgba(69, 123, 157, 0.16)", border: "rgba(69, 123, 157, 0.35)", text: "#214f73" },
  { bg: "rgba(233, 196, 106, 0.2)", border: "rgba(201, 157, 47, 0.35)", text: "#70541a" },
  { bg: "rgba(168, 120, 181, 0.16)", border: "rgba(168, 120, 181, 0.35)", text: "#643f70" },
];

function describeActivities(params: { shiftTypes: ShiftType[]; eventTypes: EventType[] }) {
  const labels: string[] = [];
  const pushUnique = (label: string) => {
    if (!labels.includes(label)) labels.push(label);
  };

  for (const type of params.shiftTypes) {
    pushUnique(toAsciiLower(shiftTypeLabels[type]));
  }
  for (const type of params.eventTypes) {
    pushUnique(type === "wedding" ? "svatba" : "event");
  }

  if (labels.length === 0) return "volno";
  return labels.join(" + ");
}

function locationBubbleLabel(location?: { code?: string | null; name?: string | null } | null) {
  if (location?.code) return capitalize(toAsciiLower(location.code));
  if (location?.name) return capitalize(toAsciiLower(location.name.replace(/^restaurace\s+/i, "")));
  return "Pobocka";
}

export default async function EmployeesCalendarPage({ searchParams }: Props) {
  const user = await requireUser();
  const params = await searchParams;
  const view = readString(params, "view") === "week" ? "week" : "month";
  const anchorDate = readString(params, "date") || toDateKey(new Date());
  const anchor = parseDateKey(anchorDate);
  const days = view === "week" ? getWeekDays(anchor) : getMonthGrid(anchor);
  const startDate = days[0];
  const endDate = days[days.length - 1];
  const { summaryMap, locations, events } = await scheduleService.dashboardContext({ startDate, endDate });
  const myAssignments = await assignmentsService.forUser(user.id);
  const myShiftIds = new Set(myAssignments.map((a) => a.shiftId));
  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const locationColorById = new Map(
    [...locations]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((location, index) => [location.id, LOCATION_CHIP_COLORS[index % LOCATION_CHIP_COLORS.length]]),
  );
  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByDate.get(event.date) ?? [];
    list.push(event);
    eventsByDate.set(event.date, list);
  }

  const prevAnchor =
    view === "week" ? toDateKey(addDays(anchor, -7)) : toDateKey(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  const nextAnchor =
    view === "week" ? toDateKey(addDays(anchor, 7)) : toDateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));

  const monthLabel = new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
  }).format(view === "month" ? startOfMonth(anchor) : anchor);
  const canSelfAssign = user.role === "brigadnik" || user.role === "admin";
  const visibleLocationIds = [...new Set(
    days.flatMap((day) => (summaryMap.get(day)?.shifts ?? []).map((shift) => shift.locationId)),
  )].filter((id) => locationMap.has(id));

  return (
    <div className="stack gap-lg">
      <section className="panel">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Přehled provozu</p>
            <h2>{monthLabel}</h2>
          </div>
          <div className="calendar-controls">
            <div className="row gap-sm calendar-nav-row">
              <Link className="button ghost" href={`/employees?view=${view}&date=${prevAnchor}`} prefetch={false}>
                Předchozí
              </Link>
              <Link className="button ghost" href={`/employees?view=${view}&date=${toDateKey(new Date())}`} prefetch={false}>
                Dnes
              </Link>
              <Link className="button ghost" href={`/employees?view=${view}&date=${nextAnchor}`} prefetch={false}>
                Další
              </Link>
            </div>
            <div className="view-slider" role="tablist" aria-label="Přepnutí zobrazení kalendáře">
              <Link
                className={`view-slide ${view === "week" ? "active" : ""}`}
                href={`/employees?view=week&date=${anchorDate}`}
                prefetch={false}
              >
                Týdenní přehled
              </Link>
              <Link
                className={`view-slide ${view === "month" ? "active" : ""}`}
                href={`/employees?view=month&date=${anchorDate}`}
                prefetch={false}
              >
                Měsíční přehled
              </Link>
            </div>
          </div>
        </div>
        {canSelfAssign ? (
          <p className="subtle tiny calendar-help">
            Klikni na den a v detailu se přihlas na směnu. Barvy níže odlišují pobočky.
          </p>
        ) : null}
        {visibleLocationIds.length > 0 ? (
          <div className="chips day-legend">
            {visibleLocationIds.map((locationId) => {
              const location = locationMap.get(locationId);
              const color = locationColorById.get(locationId);
              if (!location || !color) return null;
              return (
                <span
                  key={locationId}
                  className="chip location-legend-chip"
                  style={{
                    backgroundColor: color.bg,
                    borderColor: color.border,
                    color: color.text,
                  }}
                >
                  {location.code} • {location.name}
                </span>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className={view === "month" ? "calendar-grid month" : "calendar-grid week"}>
        {days.map((day) => {
          const summary = summaryMap.get(day);
          const dayEvents = eventsByDate.get(day) ?? [];
          const hasMyShift = summary?.shifts.some((shift) => myShiftIds.has(shift.id)) ?? false;
          const hasWedding =
            (summary?.shifts.some((shift) => shift.type === "wedding") ?? false) ||
            dayEvents.some((event) => event.type === "wedding");
          const hasEvent =
            (summary?.shifts.some((shift) => shift.type === "event") ?? false) ||
            dayEvents.some((event) => event.type === "event");
          const eventsByLocation = new Map<string, EventType[]>();
          for (const event of dayEvents) {
            const list = eventsByLocation.get(event.locationId) ?? [];
            if (!list.includes(event.type)) list.push(event.type);
            eventsByLocation.set(event.locationId, list);
          }
          const rowLocationIds = [
            ...new Set([
              ...(summary?.locationSummaries.map((item) => item.locationId) ?? []),
              ...dayEvents.map((event) => event.locationId),
            ]),
          ];
          return (
            <article
              key={day}
              className={`day-card ${hasMyShift ? "mine" : ""} ${hasWedding ? "wedding-day" : ""} ${hasEvent ? "event-day" : ""}`.trim()}
            >
              <div className="row between">
                <strong>{new Date(`${day}T00:00:00`).getDate()}.</strong>
                <Link className="chip chip-button day-open-link" href={`/employees/day/${day}`} prefetch={false}>
                  Detail dne
                </Link>
              </div>
              <p className="subtle">{new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(new Date(`${day}T00:00:00`))}</p>

              {summary || dayEvents.length > 0 ? (
                <div className="stack">
                  {rowLocationIds.map((locationId) => {
                    const location = locationMap.get(locationId);
                    const color = locationColorById.get(locationId);
                    const locationSummary = summary?.locationSummaries.find((item) => item.locationId === locationId);
                    const eventTypes = eventsByLocation.get(locationId) ?? [];
                    const activityLabel = describeActivities({
                      shiftTypes: locationSummary?.shiftTypes ?? [],
                      eventTypes,
                    });
                    const singleShiftId =
                      locationSummary && locationSummary.shiftIds.length === 1 ? locationSummary.shiftIds[0] : null;
                    const isMine = singleShiftId ? myShiftIds.has(singleShiftId) : false;
                    return (
                      <div
                        key={locationId}
                        className={`day-location-row ${isMine ? "mine-row" : ""}`.trim()}
                        style={
                          color
                            ? {
                                backgroundColor: color.bg,
                                borderColor: color.border,
                              }
                            : undefined
                        }
                      >
                        <div className="day-location-main">
                          <p className="day-location-title">
                            <strong>{locationBubbleLabel(location)}</strong>
                          </p>
                          <p className="day-location-type">{activityLabel}</p>
                          {locationSummary ? (
                            <p className="day-location-places">
                              <strong>{locationSummary.confirmedCount}/{locationSummary.minimumPeople}</strong>
                              {locationSummary.pendingCount ? ` +${locationSummary.pendingCount}` : ""}
                            </p>
                          ) : (
                            <p className="day-location-places subtle">-</p>
                          )}
                        </div>

                        {canSelfAssign && singleShiftId ? (
                          isMine ? (
                            <div className="day-location-action">
                              <ShiftAssignmentButton
                                shiftId={singleShiftId}
                                action="unassign"
                                className="chip chip-button quick-action remove"
                              >
                                Odhlásit
                              </ShiftAssignmentButton>
                            </div>
                          ) : (
                            <div className="day-location-action">
                              <ShiftAssignmentButton
                                shiftId={singleShiftId}
                                action="signup"
                                className="chip chip-button quick-action join"
                              >
                                Přihlásit
                              </ShiftAssignmentButton>
                            </div>
                          )
                        ) : canSelfAssign && locationSummary && locationSummary.shiftIds.length > 1 ? (
                          <span className="chip">Více směn</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="subtle">Bez směn</p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
