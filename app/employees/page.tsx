import { AppLink } from "@/components/app-link";
import { DayDetailView } from "@/components/day-detail-view";
import { WorkCalendarBoard } from "@/components/work-calendar-board";
import { canUseWorkRole, isManagerRole } from "@/lib/auth/role-access";
import { requireUser } from "@/lib/auth/rbac";
import { STAFF_ROLES, staffRoleLabels, shiftTypeLabels } from "@/lib/constants";
import { staffPaths } from "@/lib/paths";
import {
  getCurrentUserDashboardSnapshot,
  getShiftPresetsCached,
} from "@/lib/services/cached-reads";
import { assignmentsService } from "@/lib/services/assignments";
import { addDays, getMonthGrid, getWeekDays, parseDateKey, startOfMonth, toDateKey } from "@/lib/utils";
import type { ShiftType } from "@/types/models";

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

function buildCalendarHref(params: { view: "week" | "month"; date: string; day?: string | null }) {
  const search = new URLSearchParams();
  search.set("view", params.view);
  search.set("date", params.date);
  if (params.day) search.set("day", params.day);
  return `${staffPaths.employees}?${search.toString()}`;
}

const LOCATION_CHIP_COLORS = [
  { bg: "rgba(33, 129, 108, 0.16)", border: "rgba(33, 129, 108, 0.35)", text: "#12584a" },
  { bg: "rgba(224, 122, 95, 0.16)", border: "rgba(224, 122, 95, 0.35)", text: "#8a3f2b" },
  { bg: "rgba(69, 123, 157, 0.16)", border: "rgba(69, 123, 157, 0.35)", text: "#214f73" },
  { bg: "rgba(233, 196, 106, 0.2)", border: "rgba(201, 157, 47, 0.35)", text: "#70541a" },
  { bg: "rgba(168, 120, 181, 0.16)", border: "rgba(168, 120, 181, 0.35)", text: "#643f70" },
];

function locationBubbleLabel(location?: { code?: string | null; name?: string | null } | null) {
  if (location?.code) return capitalize(toAsciiLower(location.code));
  if (location?.name) return capitalize(toAsciiLower(location.name.replace(/^restaurace\s+/i, "")));
  return "Pobočka";
}

export default async function EmployeesCalendarPage({ searchParams }: Props) {
  const user = await requireUser();
  const params = await searchParams;
  const view = readString(params, "view") === "week" ? "week" : "month";
  const anchorDate = readString(params, "date") || toDateKey(new Date());
  const selectedDayRaw = readString(params, "day");
  const selectedDay = selectedDayRaw && /^\d{4}-\d{2}-\d{2}$/.test(selectedDayRaw) ? selectedDayRaw : null;
  const presetCreated = readString(params, "presetCreated") === "1";
  const presetDeleted = readString(params, "presetDeleted") === "1";
  const anchor = parseDateKey(anchorDate);
  const days = view === "week" ? getWeekDays(anchor) : getMonthGrid(anchor);
  const startDate = days[0];
  const endDate = days[days.length - 1];
  const [dashboardSnapshot, myAssignments, shiftPresets] = await Promise.all([
    getCurrentUserDashboardSnapshot(startDate, endDate),
    assignmentsService.forUser(user.id),
    isManagerRole(user.role) ? getShiftPresetsCached() : Promise.resolve([]),
  ]);
  const allShiftIds = [
    ...new Set(
      dashboardSnapshot.summaryEntries.flatMap(([, summary]) => summary.shifts.map((shift) => shift.id)),
    ),
  ];
  const rangeAssignments = allShiftIds.length > 0 ? await assignmentsService.forShiftIds(allShiftIds) : [];
  const summaryMap = new Map(dashboardSnapshot.summaryEntries);
  const locations = dashboardSnapshot.locations;
  const events = dashboardSnapshot.events;
  const myShiftIds = new Set(myAssignments.map((a) => a.shiftId));
  const roleCountsByShift = new Map<string, Map<(typeof STAFF_ROLES)[number], number>>();
  for (const assignment of rangeAssignments) {
    const roleMap = roleCountsByShift.get(assignment.shiftId) ?? new Map<(typeof STAFF_ROLES)[number], number>();
    roleMap.set(assignment.staffRole, (roleMap.get(assignment.staffRole) ?? 0) + 1);
    roleCountsByShift.set(assignment.shiftId, roleMap);
  }
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
  const canSelfAssign = canUseWorkRole(user.role);
  const canManageCalendar = isManagerRole(user.role);
  const visibleLocationIds = [...new Set(
    days.flatMap((day) => (summaryMap.get(day)?.shifts ?? []).map((shift) => shift.locationId)),
  )].filter((id) => locationMap.has(id));
  const calendarBaseHref = buildCalendarHref({ view, date: anchorDate });
  const dayCards = days.map((day) => {
    const summary = summaryMap.get(day);
    const dayDate = new Date(`${day}T00:00:00`);
    const isOutsideAnchorMonth =
      view === "month" && (dayDate.getMonth() !== anchor.getMonth() || dayDate.getFullYear() !== anchor.getFullYear());
    const dayEvents = eventsByDate.get(day) ?? [];
    const hasMyShift = summary?.shifts.some((shift) => myShiftIds.has(shift.id)) ?? false;
    const hasWedding =
      (summary?.shifts.some((shift) => shift.type === "wedding") ?? false) ||
      dayEvents.some((event) => event.type === "wedding");
    const hasEvent =
      (summary?.shifts.some((shift) => shift.type === "event") ?? false) ||
      dayEvents.some((event) => event.type === "event");
    return {
      date: day,
      dayNumber: dayDate.getDate(),
      weekdayLabel: new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(dayDate),
      href: buildCalendarHref({ view, date: anchorDate, day }),
      className: `day-card ${hasMyShift ? "mine" : ""} ${hasWedding ? "wedding-day" : ""} ${hasEvent ? "event-day" : ""} ${isOutsideAnchorMonth ? "outside-month" : ""}`.trim(),
      shifts: (summary?.shifts ?? []).map((shift) => {
        const location = locationMap.get(shift.locationId);
        const color = locationColorById.get(shift.locationId);

        return {
          shiftId: shift.id,
          locationLabel: locationBubbleLabel(location),
          timeLabel: `${shift.startTime}–${shift.endTime}`,
          roleStats: shift.requiredRoles
            .filter((item) => item.count > 0)
            .map((item) => ({
              label: staffRoleLabels[item.role],
              assigned: roleCountsByShift.get(shift.id)?.get(item.role) ?? 0,
              required: item.count,
            })),
          isMine: myShiftIds.has(shift.id),
          color,
        };
      }),
      emptyStateLabel: "Bez směn",
    };
  });

  return (
    <div className="stack gap-lg">
      <section className="panel">
        <div className="row between wrap calendar-header-row">
          <div>
            <p className="eyebrow">Přehled provozu</p>
            <h2>{monthLabel}</h2>
          </div>
          <div className="calendar-controls">
            <div className="row gap-sm calendar-nav-row">
              <AppLink className="button ghost small" href={buildCalendarHref({ view, date: prevAnchor })}>
                Předchozí
              </AppLink>
              <AppLink className="button ghost small" href={buildCalendarHref({ view, date: toDateKey(new Date()) })}>
                Dnes
              </AppLink>
              <AppLink className="button ghost small" href={buildCalendarHref({ view, date: nextAnchor })}>
                Další
              </AppLink>
            </div>
            <div className="view-slider" role="tablist" aria-label="Přepnutí zobrazení kalendáře">
              <AppLink
                className={`view-slide ${view === "week" ? "active" : ""}`}
                href={buildCalendarHref({ view: "week", date: anchorDate })}
              >
                Týdenní přehled
              </AppLink>
              <AppLink
                className={`view-slide ${view === "month" ? "active" : ""}`}
                href={buildCalendarHref({ view: "month", date: anchorDate })}
              >
                Měsíční přehled
              </AppLink>
            </div>
          </div>
        </div>
        {visibleLocationIds.length > 0 ? (
          <div className="chips day-legend compact-legend">
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
                  title={location.name}
                >
                  {location.code || location.name}
                </span>
              );
            })}
          </div>
        ) : null}
      </section>

      <WorkCalendarBoard
        days={dayCards}
        view={view}
        canSelfAssign={canSelfAssign}
        canManageCalendar={canManageCalendar}
        locations={locations}
        shiftPresets={shiftPresets}
        currentHref={calendarBaseHref}
        presetCreated={presetCreated}
        presetDeleted={presetDeleted}
      />

      {selectedDay ? (
        <div className="calendar-overlay" role="dialog" aria-modal="true" aria-label={`Detail dne ${selectedDay}`}>
          <AppLink className="calendar-overlay-backdrop" href={calendarBaseHref} scroll={false} aria-label="Zavřít detail dne" />
          <div className="calendar-overlay-panel">
            <DayDetailView
              date={selectedDay}
              user={user}
              embedded
              closeHref={calendarBaseHref}
              redirectTo={buildCalendarHref({ view, date: anchorDate, day: selectedDay })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
