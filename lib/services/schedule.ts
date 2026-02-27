import { assignmentsService } from "@/lib/services/assignments";
import { eventsService } from "@/lib/services/events";
import { locationsService } from "@/lib/services/locations";
import { startPerfTrace } from "@/lib/perf";
import { shiftsService } from "@/lib/services/shifts";
import { usersService } from "@/lib/services/users";
import type { AssignmentRecord, ShiftRecord } from "@/types/models";

export interface DayShiftView {
  shift: ShiftRecord;
  assignments: Array<
    AssignmentRecord & {
      userName?: string;
      userRole?: string;
    }
  >;
  occupancy: {
    confirmed: number;
    pending: number;
    total: number;
  };
}

export interface DaySummary {
  date: string;
  dayType: "restaurant" | "wedding" | "event" | "mixed";
  shifts: ShiftRecord[];
  minimumPeople: number;
  confirmedCount: number;
  pendingCount: number;
  locationSummaries: Array<{
    locationId: string;
    shiftIds: string[];
    shiftTypes: ShiftRecord["type"][];
    minimumPeople: number;
    confirmedCount: number;
    pendingCount: number;
  }>;
}

class ScheduleService {
  async getDayDetails(date: string): Promise<DayShiftView[]> {
    const trace = startPerfTrace("schedule.get_day_details", { date });
    try {
      const [shifts, allUsers] = await Promise.all([shiftsService.forDate(date), usersService.loadAll()]);
      trace.step("load_shifts_users", { shifts: shifts.length, users: allUsers.length });
      const shiftIds = shifts.map((shift) => shift.id);
      const allAssignments = await assignmentsService.forShiftIds(shiftIds);
      trace.step("load_assignments_for_shifts", { assignments: allAssignments.length });
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const assignmentByShift = new Map<string, AssignmentRecord[]>();
      const occupancyByShift = new Map<string, { confirmed: number; pending: number; total: number }>();
      for (const assignment of allAssignments) {
        const list = assignmentByShift.get(assignment.shiftId) ?? [];
        list.push(assignment);
        assignmentByShift.set(assignment.shiftId, list);

        const stats = occupancyByShift.get(assignment.shiftId) ?? { confirmed: 0, pending: 0, total: 0 };
        stats.total += 1;
        if (assignment.status === "confirmed") stats.confirmed += 1;
        if (assignment.status === "pending") stats.pending += 1;
        occupancyByShift.set(assignment.shiftId, stats);
      }

      const result: DayShiftView[] = [];
      for (const shift of shifts) {
        const assignments = assignmentByShift.get(shift.id) ?? [];
        const occupancy = occupancyByShift.get(shift.id) ?? { confirmed: 0, pending: 0, total: 0 };
        result.push({
          shift,
          assignments: assignments.map((a) => ({
            ...a,
            userName: userMap.get(a.userId)?.name,
            userRole: userMap.get(a.userId)?.role,
          })),
          occupancy,
        });
        trace.step("shift_detail", {
          shift_id: shift.id,
          assignments: assignments.length,
          confirmed: occupancy.confirmed,
          pending: occupancy.pending,
        });
      }
      trace.end({ rows: result.length });
      return result;
    } catch (error) {
      trace.fail(error);
      throw error;
    }
  }

  async getDaySummaries(startDate: string, endDate: string): Promise<Map<string, DaySummary>> {
    const trace = startPerfTrace("schedule.get_day_summaries", { startDate, endDate });
    const shifts = await shiftsService.forDateRange(startDate, endDate);
    const shiftIds = shifts.map((shift) => shift.id);
    const assignments = await assignmentsService.forShiftIds(shiftIds);
    trace.step("load_shifts_assignments", { shifts: shifts.length, assignments: assignments.length });
    const occupancyByShift = new Map<string, { confirmed: number; pending: number }>();
    for (const assignment of assignments) {
      const stats = occupancyByShift.get(assignment.shiftId) ?? { confirmed: 0, pending: 0 };
      if (assignment.status === "confirmed") stats.confirmed += 1;
      if (assignment.status === "pending") stats.pending += 1;
      occupancyByShift.set(assignment.shiftId, stats);
    }
    trace.step("group_assignments", { unique_shifts: occupancyByShift.size });

    const summaryByDate = new Map<string, DaySummary>();
    for (const shift of shifts) {
      const stats = occupancyByShift.get(shift.id);
      const confirmed = stats?.confirmed ?? 0;
      const pending = stats?.pending ?? 0;

      const existing = summaryByDate.get(shift.date);
      const shiftType = shift.type;
      const dayType = !existing
        ? shiftType
        : existing.dayType === shiftType
          ? existing.dayType
          : "mixed";
      const locationMap = new Map(
        (existing?.locationSummaries ?? []).map((item) => [item.locationId, item]),
      );
      const existingLocation = locationMap.get(shift.locationId);
      locationMap.set(shift.locationId, {
        locationId: shift.locationId,
        shiftIds: [...(existingLocation?.shiftIds ?? []), shift.id],
        shiftTypes: existingLocation?.shiftTypes.includes(shift.type)
          ? existingLocation.shiftTypes
          : [...(existingLocation?.shiftTypes ?? []), shift.type],
        minimumPeople: (existingLocation?.minimumPeople ?? 0) + shift.minimumPeople,
        confirmedCount: (existingLocation?.confirmedCount ?? 0) + confirmed,
        pendingCount: (existingLocation?.pendingCount ?? 0) + pending,
      });

      summaryByDate.set(shift.date, {
        date: shift.date,
        dayType,
        shifts: [...(existing?.shifts ?? []), shift],
        minimumPeople: (existing?.minimumPeople ?? 0) + shift.minimumPeople,
        confirmedCount: (existing?.confirmedCount ?? 0) + confirmed,
        pendingCount: (existing?.pendingCount ?? 0) + pending,
        locationSummaries: [...locationMap.values()].sort((a, b) => a.locationId.localeCompare(b.locationId)),
      });
    }
    trace.end({ days: summaryByDate.size });
    return summaryByDate;
  }

  async myShifts(userId: string) {
    const trace = startPerfTrace("schedule.my_shifts", { user_id: userId });
    const [assignments, locations] = await Promise.all([
      assignmentsService.forUser(userId),
      locationsService.loadAll(),
    ]);
    const shifts = await shiftsService.forIds([...new Set(assignments.map((assignment) => assignment.shiftId))]);
    trace.step("load_assignments_shifts_locations", {
      assignments: assignments.length,
      shifts: shifts.length,
      locations: locations.length,
    });
    const shiftMap = new Map(shifts.map((s) => [s.id, s]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));
    const result = assignments
      .map((assignment) => {
        const shift = shiftMap.get(assignment.shiftId);
        if (!shift) return null;
        return {
          assignment,
          shift,
          location: locationMap.get(shift.locationId) ?? null,
        };
      })
      .filter(
        (
          item,
        ): item is {
          assignment: AssignmentRecord;
          shift: ShiftRecord;
          location: Awaited<ReturnType<typeof locationsService.loadAll>>[number] | null;
        } => item !== null,
      )
      .sort((a, b) => `${a.shift.date}${a.shift.startTime}`.localeCompare(`${b.shift.date}${b.shift.startTime}`));
    trace.end({ rows: result.length });
    return result;
  }

  async dashboardContext(dateRange: { startDate: string; endDate: string }) {
    const trace = startPerfTrace("schedule.dashboard_context", {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    const [summaryMap, locations, events] = await Promise.all([
      this.getDaySummaries(dateRange.startDate, dateRange.endDate),
      locationsService.loadAll(),
      eventsService.forDateRange(dateRange.startDate, dateRange.endDate),
    ]);
    trace.step("load_context", {
      days: summaryMap.size,
      locations: locations.length,
      events: events.length,
    });
    const result = {
      summaryMap,
      locations,
      events,
    };
    trace.end({ filtered_events: result.events.length });
    return result;
  }
}

export const scheduleService = new ScheduleService();
