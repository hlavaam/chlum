"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { APP_ROLES, AVAILABILITY_STATUSES, EVENT_TYPES, SHIFT_TYPES, STAFF_ROLES } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireRoles, requireUser } from "@/lib/auth/rbac";
import { assignmentsService } from "@/lib/services/assignments";
import { eventsService } from "@/lib/services/events";
import { locationsService } from "@/lib/services/locations";
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

export async function loginAction(formData: FormData) {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const user = await usersService.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash) || !user.active) {
    redirect("/login?error=1");
  }
  await setSessionCookie(user.id);
  redirect("/employees");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function signupShiftAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "brigadnik" && user.role !== "admin") {
    redirect("/admin/schedule");
  }
  const shiftId = getString(formData, "shiftId");
  const date = getString(formData, "date");
  const role: StaffRole = user.preferredRoles[0] ?? "service";
  await shiftsService.signup(shiftId, user, role);
  revalidatePath("/employees");
  revalidatePath(`/employees/day/${date}`);
  revalidatePath("/employees/my");
}

export async function unassignShiftAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "brigadnik" && user.role !== "admin") {
    redirect("/admin/schedule");
  }
  const shiftId = getString(formData, "shiftId");
  const date = getString(formData, "date");
  await shiftsService.unassign(shiftId, user.id);
  revalidatePath("/employees");
  revalidatePath(`/employees/day/${date}`);
  revalidatePath("/employees/my");
}

export async function updateMyPreferencesAction(formData: FormData) {
  const user = await requireUser();
  const roles = getStringArray(formData, "preferredRoles").filter((role): role is StaffRole =>
    STAFF_ROLES.includes(role as StaffRole),
  );
  await usersService.updatePreferences(user.id, roles);
  revalidatePath("/employees/my");
  redirect("/employees/my");
}

export async function updateAvailabilityAction(formData: FormData) {
  const user = await requireUser();
  const date = getString(formData, "date");
  const status = getString(formData, "status") as AvailabilityStatus;
  if (!date || !AVAILABILITY_STATUSES.includes(status)) {
    redirect("/employees/my");
  }
  await usersService.updateAvailability(user.id, date, status);
  revalidatePath("/employees/my");
  redirect("/employees/my");
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
  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  redirectBack(formData, `/admin/schedule?tab=calendar&date=${dateFrom}`);
}

export async function createEventAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const type = getString(formData, "type") as EventType;
  if (!EVENT_TYPES.includes(type)) redirect("/admin/events");
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
  revalidatePath("/admin/events");
  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  redirect("/admin/events");
}

export async function deleteEventAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const eventId = getString(formData, "eventId");
  const date = getString(formData, "date");
  if (!eventId) redirect("/admin/events");
  await eventsService.delete(eventId);
  revalidatePath("/admin/events");
  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  if (date) revalidatePath(`/employees/day/${date}`);
  redirectBack(formData, "/admin/events");
}

export async function toggleShiftApprovalAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const shiftId = getString(formData, "shiftId");
  const shift = await shiftsService.findById(shiftId);
  if (!shift) redirect("/admin/schedule");
  await shiftsService.update(shiftId, { requiresApproval: !shift.requiresApproval });
  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  redirect("/admin/schedule");
}

export async function updateAssignmentStatusAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const assignmentId = getString(formData, "assignmentId");
  const status = getString(formData, "status");
  if (status !== "confirmed" && status !== "pending") redirect("/admin/schedule");
  await assignmentsService.setStatus(assignmentId, status);
  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  redirect("/admin/schedule");
}

export async function removeAssignmentAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const assignmentId = getString(formData, "assignmentId");
  const date = getString(formData, "date");
  if (!assignmentId) redirect("/admin/schedule");
  await assignmentsService.delete(assignmentId);
  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  if (date) revalidatePath(`/employees/day/${date}`);
  redirectBack(formData, date ? `/employees/day/${date}` : "/employees");
}

export async function manualAssignAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const shiftId = getString(formData, "shiftId");
  const userId = getString(formData, "userId");
  const user = await usersService.findById(userId);
  if (!user) redirect("/admin/schedule");
  await shiftsService.signup(shiftId, user, user.preferredRoles[0] ?? "service", "confirmed");
  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  redirect("/admin/schedule");
}

export async function updateShiftAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const shiftId = getString(formData, "shiftId");
  const shift = await shiftsService.findById(shiftId);
  if (!shift) redirect("/admin/schedule");

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

  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  revalidatePath(`/employees/day/${shift.date}`);
  revalidatePath(`/employees/day/${nextDate}`);
  redirectBack(formData, `/admin/schedule?tab=admin&date=${nextDate}`);
}

export async function deleteShiftAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const shiftId = getString(formData, "shiftId");
  const date = getString(formData, "date");
  await shiftsService.deleteCascade(shiftId);
  revalidatePath("/admin/schedule");
  revalidatePath("/employees");
  if (date) revalidatePath(`/employees/day/${date}`);
  redirectBack(formData, `/admin/schedule?tab=admin&date=${date || ""}`);
}

export async function createLocationAction(formData: FormData) {
  await requireRoles(["admin"]);
  await locationsService.create({
    name: getString(formData, "name"),
    code: getString(formData, "code"),
    address: getString(formData, "address"),
  });
  revalidatePath("/admin/people");
  revalidatePath("/admin/events");
  revalidatePath("/admin/schedule");
  redirect("/admin/people");
}

export async function updateLocationAction(formData: FormData) {
  await requireRoles(["admin"]);
  const locationId = getString(formData, "locationId");
  if (!locationId) redirect("/admin/people");
  await locationsService.update(locationId, {
    name: getString(formData, "name"),
    code: getString(formData, "code"),
    address: getString(formData, "address"),
  });
  revalidatePath("/admin/people");
  revalidatePath("/admin/events");
  revalidatePath("/admin/schedule");
  redirect("/admin/people");
}

export async function createUserAction(formData: FormData) {
  await requireRoles(["admin"]);
  const role = getString(formData, "role") as AppRole;
  if (!APP_ROLES.includes(role)) redirect("/admin/people");
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
  revalidatePath("/admin/people");
  redirect("/admin/people");
}

export async function updateUserRoleAction(formData: FormData) {
  await requireRoles(["admin"]);
  const userId = getString(formData, "userId");
  const role = getString(formData, "role") as AppRole;
  if (!APP_ROLES.includes(role)) redirect("/admin/people");
  await usersService.update(userId, { role });
  revalidatePath("/admin/people");
  redirect("/admin/people");
}
