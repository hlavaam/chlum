"use server";

import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { APP_ROLES, AVAILABILITY_STATUSES, EVENT_TYPES, SHIFT_TYPES, STAFF_ROLES } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireRoles, requireUser } from "@/lib/auth/rbac";
import { assignmentsService } from "@/lib/services/assignments";
import { eventsService } from "@/lib/services/events";
import { locationsService } from "@/lib/services/locations";
import { staffPaths } from "@/lib/paths";
import { shiftsService } from "@/lib/services/shifts";
import { usersService } from "@/lib/services/users";
import type {
  AppRole,
  AvailabilityStatus,
  EventType,
  RoleRequirement,
  ShiftType,
  StaffRole,
} from "@/types/models";
import { toDateKey } from "@/lib/utils";

type DataTag = "users" | "locations" | "events" | "shifts" | "assignments";

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((v) => (typeof v === "string" ? v : ""))
    .map((v) => v.trim())
    .filter(Boolean);
}

function getNumber(formData: FormData, key: string, fallback = 0): number {
  const value = Number(getString(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function normalizeTimeInput(value: string): string {
  return /^\d{2}:\d{2}$/.test(value) ? value : "";
}

function isFlexibleEndTime(formData: FormData): boolean {
  return getString(formData, "endTimeFlexible") === "on";
}

function parseWeekdaySet(formData: FormData): Set<number> {
  const map: Record<string, number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 0,
  };
  const values = getStringArray(formData, "weekdays");
  const set = new Set<number>();
  for (const value of values) {
    if (value in map) set.add(map[value]);
  }
  return set;
}

function enumerateDates(fromDate: string, toDate: string, weekdaySet: Set<number>): string[] {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];
  const out: string[] = [];
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (weekdaySet.size === 0 || weekdaySet.has(day)) {
      out.push(toDateKey(new Date(d)));
    }
  }
  return out;
}

function parseCustomDates(raw: string): string[] {
  const values = raw
    .split(/[\s,;]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function defaultShiftTimes(type: ShiftType, startTimeRaw: string, endTimeRaw: string) {
  const startTime = normalizeTimeInput(startTimeRaw);
  const endTime = normalizeTimeInput(endTimeRaw);
  if (type === "restaurant") {
    return {
      startTime: startTime || "10:00",
      endTime: endTime || "22:00",
    };
  }
  return {
    startTime: startTime || "12:00",
    endTime: endTime || "23:00",
  };
}

function applyShiftPreset(input: {
  preset: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  minimumPeople: number;
  notes: string;
}): {
  type: ShiftType;
  startTime: string;
  endTime: string;
  minimumPeople: number;
  notes: string;
} {
  const presets: Record<string, Partial<typeof input>> = {
    restaurant_to_16: {
      type: "restaurant",
      startTime: "10:00",
      endTime: "16:00",
      minimumPeople: 2,
      notes: "Restaurace otevřeno do 16:00",
    },
    restaurant_full: {
      type: "restaurant",
      startTime: "10:00",
      endTime: "22:00",
      minimumPeople: 3,
      notes: "Restaurace standard",
    },
    wedding_day: {
      type: "wedding",
      startTime: "12:00",
      endTime: "23:00",
      minimumPeople: 6,
      notes: "Svatba",
    },
    event_evening: {
      type: "event",
      startTime: "16:00",
      endTime: "22:00",
      minimumPeople: 4,
      notes: "Akce",
    },
  };

  const preset = presets[input.preset];
  if (!preset) return input;
  return {
    type: (preset.type as ShiftType) ?? input.type,
    startTime: (preset.startTime as string) ?? input.startTime,
    endTime: (preset.endTime as string) ?? input.endTime,
    minimumPeople: (preset.minimumPeople as number) ?? input.minimumPeople,
    notes: (preset.notes as string) ?? input.notes,
  };
}

function parseRoleRequirements(formData: FormData): RoleRequirement[] {
  return STAFF_ROLES.map((role) => ({
    role,
    count: getNumber(formData, `${role}Count`, 0),
  })).filter((item) => item.count > 0);
}

function redirectBack(formData: FormData, fallback: string) {
  const target = getString(formData, "redirectTo") || fallback;
  redirect(target);
}

function revalidateDataTags(...tags: DataTag[]) {
  for (const tag of new Set(tags)) {
    revalidateTag(tag);
  }
}

export async function loginAction(formData: FormData) {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const user = await usersService.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash) || !user.active) {
    redirect(`${staffPaths.login}?error=1`);
  }
  await setSessionCookie(user.id);
  redirect(staffPaths.employees);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect(staffPaths.login);
}

export async function signupShiftAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "brigadnik" && user.role !== "admin") {
    redirect(staffPaths.adminSchedule);
  }
  const shiftId = getString(formData, "shiftId");
  const date = getString(formData, "date");
  const role: StaffRole = user.preferredRoles[0] ?? "service";
  await shiftsService.signup(shiftId, user, role);
  revalidateDataTags("assignments", "shifts");
  revalidatePath(staffPaths.employees);
  revalidatePath(staffPaths.employeeDay(date));
  revalidatePath(staffPaths.employeesMy);
}

export async function unassignShiftAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "brigadnik" && user.role !== "admin") {
    redirect(staffPaths.adminSchedule);
  }
  const shiftId = getString(formData, "shiftId");
  const date = getString(formData, "date");
  await shiftsService.unassign(shiftId, user.id);
  revalidateDataTags("assignments", "shifts");
  revalidatePath(staffPaths.employees);
  revalidatePath(staffPaths.employeeDay(date));
  revalidatePath(staffPaths.employeesMy);
}

export async function updateMyPreferencesAction(formData: FormData) {
  const user = await requireUser();
  const roles = getStringArray(formData, "preferredRoles").filter((role): role is StaffRole =>
    STAFF_ROLES.includes(role as StaffRole),
  );
  await usersService.updatePreferences(user.id, roles);
  revalidateDataTags("users");
  revalidatePath(staffPaths.employeesMy);
  redirect(staffPaths.employeesMy);
}

export async function updateAvailabilityAction(formData: FormData) {
  const user = await requireUser();
  const date = getString(formData, "date");
  const status = getString(formData, "status") as AvailabilityStatus;
  if (!date || !AVAILABILITY_STATUSES.includes(status)) {
    redirect(staffPaths.employeesMy);
  }
  await usersService.updateAvailability(user.id, date, status);
  revalidateDataTags("users");
  revalidatePath(staffPaths.employeesMy);
  redirect(staffPaths.employeesMy);
}

export async function createShiftAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const rawType = getString(formData, "type") as ShiftType;
  const preset = getString(formData, "preset");
  const fallbackType: ShiftType = SHIFT_TYPES.includes(rawType) ? rawType : "restaurant";
  const dateFrom = getString(formData, "dateFrom") || getString(formData, "date");
  const dateTo = getString(formData, "dateTo") || dateFrom;
  const customDates = parseCustomDates(getString(formData, "customDates"));
  const targetDates =
    customDates.length > 0 ? customDates : enumerateDates(dateFrom, dateTo, parseWeekdaySet(formData));
  const minimumPeopleInput = getNumber(formData, "minimumPeople");
  const baseTimes = defaultShiftTimes(
    fallbackType,
    getString(formData, "startTime"),
    getString(formData, "endTime"),
  );
  const merged = applyShiftPreset({
    preset,
    type: fallbackType,
    startTime: baseTimes.startTime,
    endTime: baseTimes.endTime,
    minimumPeople: getNumber(formData, "minimumPeople"),
    notes: getString(formData, "notes"),
  });
  const locationId = getString(formData, "locationId");
  const endTime = isFlexibleEndTime(formData) ? "dle situace" : merged.endTime;
  const allShifts = await shiftsService.loadAll();

  for (const date of targetDates.length ? targetDates : [dateFrom]) {
    if (!date) continue;
    const existing = allShifts.find((shift) => shift.date === date && shift.locationId === locationId);
    const payload = {
      date,
      startTime: merged.startTime,
      endTime,
      locationId,
      type: merged.type,
      requiredRoles: [],
      minimumPeople: Math.max(0, minimumPeopleInput),
      requiresApproval: getString(formData, "requiresApproval") === "on",
      notes: merged.notes || undefined,
    };
    if (existing) {
      await shiftsService.update(existing.id, payload);
    } else {
      await shiftsService.create(payload);
    }
  }
  revalidateDataTags("shifts");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  redirectBack(formData, staffPaths.adminScheduleWithParams({ tab: "calendar", date: dateFrom }));
}

export async function createEventAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const type = getString(formData, "type") as EventType;
  if (!EVENT_TYPES.includes(type)) redirect(staffPaths.adminEvents);
  const startTime = normalizeTimeInput(getString(formData, "startTime")) || "12:00";
  const endTime = isFlexibleEndTime(formData)
    ? "dle situace"
    : normalizeTimeInput(getString(formData, "endTime")) || "23:00";
  await eventsService.create({
    name: getString(formData, "name"),
    type,
    date: getString(formData, "date"),
    startTime,
    endTime,
    locationId: getString(formData, "locationId"),
    requiredRoles: [],
    minimumPeople: getNumber(formData, "minimumPeople"),
    notes: getString(formData, "notes"),
  });
  revalidateDataTags("events", "shifts");
  revalidatePath(staffPaths.adminEvents);
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  redirect(staffPaths.adminEvents);
}

export async function deleteEventAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const eventId = getString(formData, "eventId");
  const date = getString(formData, "date");
  if (!eventId) redirect(staffPaths.adminEvents);
  await eventsService.delete(eventId);
  revalidateDataTags("events", "shifts", "assignments");
  revalidatePath(staffPaths.adminEvents);
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  if (date) revalidatePath(staffPaths.employeeDay(date));
  redirectBack(formData, staffPaths.adminEvents);
}

export async function toggleShiftApprovalAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const shiftId = getString(formData, "shiftId");
  const shift = await shiftsService.findById(shiftId);
  if (!shift) redirect(staffPaths.adminSchedule);
  await shiftsService.update(shiftId, { requiresApproval: !shift.requiresApproval });
  revalidateDataTags("shifts");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  redirect(staffPaths.adminSchedule);
}

export async function updateAssignmentStatusAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const assignmentId = getString(formData, "assignmentId");
  const status = getString(formData, "status");
  if (status !== "confirmed" && status !== "pending") redirect(staffPaths.adminSchedule);
  await assignmentsService.setStatus(assignmentId, status);
  revalidateDataTags("assignments");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  redirect(staffPaths.adminSchedule);
}

export async function removeAssignmentAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const assignmentId = getString(formData, "assignmentId");
  const date = getString(formData, "date");
  if (!assignmentId) redirect(staffPaths.adminSchedule);
  await assignmentsService.delete(assignmentId);
  revalidateDataTags("assignments");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  if (date) revalidatePath(staffPaths.employeeDay(date));
  redirectBack(formData, date ? staffPaths.employeeDay(date) : staffPaths.employees);
}

export async function manualAssignAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const shiftId = getString(formData, "shiftId");
  const userId = getString(formData, "userId");
  const user = await usersService.findById(userId);
  if (!user) redirect(staffPaths.adminSchedule);
  await shiftsService.signup(shiftId, user, user.preferredRoles[0] ?? "service", "confirmed");
  revalidateDataTags("assignments", "shifts");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  redirect(staffPaths.adminSchedule);
}

export async function updateShiftAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const shiftId = getString(formData, "shiftId");
  const shift = await shiftsService.findById(shiftId);
  if (!shift) redirect(staffPaths.adminSchedule);

  const nextDate = getString(formData, "date") || shift.date;
  const rawType = getString(formData, "type") as ShiftType;
  const nextType: ShiftType = SHIFT_TYPES.includes(rawType) ? rawType : shift.type;
  const startTime = normalizeTimeInput(getString(formData, "startTime")) || shift.startTime;
  const endTime = isFlexibleEndTime(formData)
    ? "dle situace"
    : normalizeTimeInput(getString(formData, "endTime")) || shift.endTime;
  const locationId = getString(formData, "locationId") || shift.locationId;
  const minimumPeople = Math.max(0, getNumber(formData, "minimumPeople", shift.minimumPeople));
  const notes = getString(formData, "notes");
  const requiresApproval = getString(formData, "requiresApproval") === "on";

  await shiftsService.update(shiftId, {
    date: nextDate,
    type: nextType,
    startTime,
    endTime,
    locationId,
    minimumPeople,
    requiresApproval,
    notes: notes || undefined,
  });

  revalidateDataTags("shifts");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  revalidatePath(staffPaths.employeeDay(shift.date));
  revalidatePath(staffPaths.employeeDay(nextDate));
  redirectBack(formData, staffPaths.adminScheduleWithParams({ tab: "admin", date: nextDate }));
}

export async function deleteShiftAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const shiftId = getString(formData, "shiftId");
  const date = getString(formData, "date");
  await shiftsService.deleteCascade(shiftId);
  revalidateDataTags("shifts", "assignments");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  if (date) revalidatePath(staffPaths.employeeDay(date));
  redirectBack(formData, staffPaths.adminScheduleWithParams({ tab: "admin", date: date || undefined }));
}

export async function createLocationAction(formData: FormData) {
  await requireRoles(["admin"]);
  await locationsService.create({
    name: getString(formData, "name"),
    code: getString(formData, "code"),
    address: getString(formData, "address"),
  });
  revalidateDataTags("locations");
  revalidatePath(staffPaths.adminPeople);
  revalidatePath(staffPaths.adminEvents);
  revalidatePath(staffPaths.adminSchedule);
  redirect(staffPaths.adminPeople);
}

export async function updateLocationAction(formData: FormData) {
  await requireRoles(["admin"]);
  const locationId = getString(formData, "locationId");
  if (!locationId) redirect(staffPaths.adminPeople);
  await locationsService.update(locationId, {
    name: getString(formData, "name"),
    code: getString(formData, "code"),
    address: getString(formData, "address"),
  });
  revalidateDataTags("locations");
  revalidatePath(staffPaths.adminPeople);
  revalidatePath(staffPaths.adminEvents);
  revalidatePath(staffPaths.adminSchedule);
  redirect(staffPaths.adminPeople);
}

export async function createUserAction(formData: FormData) {
  await requireRoles(["admin"]);
  const role = getString(formData, "role") as AppRole;
  if (!APP_ROLES.includes(role)) redirect(staffPaths.adminPeople);
  const locationIds = getStringArray(formData, "locationIds");
  const password = getString(formData, "password");
  await usersService.create({
    name: getString(formData, "name"),
    email: getString(formData, "email"),
    passwordHash: hashPassword(password || "heslo123"),
    role,
    active: true,
    locationIds,
    preferredRoles: [],
    availabilityByDate: {},
  });
  revalidateDataTags("users");
  revalidatePath(staffPaths.adminPeople);
  redirect(staffPaths.adminPeople);
}

export async function updateUserRoleAction(formData: FormData) {
  await requireRoles(["admin"]);
  const userId = getString(formData, "userId");
  const role = getString(formData, "role") as AppRole;
  if (!APP_ROLES.includes(role)) redirect(staffPaths.adminPeople);
  await usersService.update(userId, { role });
  revalidateDataTags("users");
  revalidatePath(staffPaths.adminPeople);
  redirect(staffPaths.adminPeople);
}

export async function updateUserPasswordAction(formData: FormData) {
  await requireRoles(["admin"]);
  const userId = getString(formData, "userId");
  const password = getString(formData, "password");
  if (!userId || password.length < 6) redirect(staffPaths.adminPeople);
  await usersService.update(userId, { passwordHash: hashPassword(password) });
  revalidateDataTags("users");
  revalidatePath(staffPaths.adminPeople);
  redirect(staffPaths.adminPeople);
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireRoles(["admin"]);
  const userId = getString(formData, "userId");
  if (!userId || userId === admin.id) redirect(staffPaths.adminPeople);
  await assignmentsService.deleteForUser(userId);
  await usersService.delete(userId);
  revalidateDataTags("users", "assignments");
  revalidatePath(staffPaths.adminPeople);
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  redirect(staffPaths.adminPeople);
}
