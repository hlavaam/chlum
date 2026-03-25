"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { canManageUserAccount, canUseWorkRole, getAssignableRoles, isBaseRole, isManagerRole } from "@/lib/auth/role-access";
import {
  APP_ROLES,
  AVAILABILITY_STATUSES,
  EVENT_TYPES,
  SHIFT_TYPES,
  STAFF_ROLES,
  WORK_DAY_PREFERENCES,
  WORK_PERIODS,
} from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireRoles, requireUser } from "@/lib/auth/rbac";
import { assignmentsService } from "@/lib/services/assignments";
import { baseAttendanceService } from "@/lib/services/base-attendance";
import { calendarConnectionsService } from "@/lib/services/calendar-connections";
import { calendarSyncsService } from "@/lib/services/calendar-syncs";
import { eventsService } from "@/lib/services/events";
import {
  deleteGoogleCalendarEventForAssignment,
  syncGoogleCalendarForShift,
  upsertGoogleCalendarEventForAssignment,
} from "@/lib/services/google-calendar-sync";
import { invitesService } from "@/lib/services/invites";
import { locationsService } from "@/lib/services/locations";
import { adminPaths, staffPaths, workPaths } from "@/lib/paths";
import { upsertShiftForDate } from "@/lib/services/shift-upserts";
import { shiftPresetsService } from "@/lib/services/shift-presets";
import { shiftsService } from "@/lib/services/shifts";
import { usersService } from "@/lib/services/users";
import { uploadUserPhoto } from "@/lib/services/user-photos";
import type {
  AppRole,
  AvailabilityStatus,
  EventType,
  RoleRequirement,
  ShiftType,
  StaffRole,
  WorkDayPreference,
  WorkPeriod,
} from "@/types/models";
import { nowIso, toDateKey } from "@/lib/utils";

type DataTag =
  | "users"
  | "locations"
  | "events"
  | "shifts"
  | "shift_presets"
  | "assignments"
  | "base_attendance"
  | "invites"
  | "calendar_connections"
  | "calendar_syncs";

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

function normalizePinInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function normalizeDateTimeLocalInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
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

function parseRoleRequirements(formData: FormData): RoleRequirement[] {
  return STAFF_ROLES.map((role) => ({
    role,
    count: getNumber(formData, `${role}Count`, 0),
  })).filter((item) => item.count > 0);
}

function sumRoleRequirements(requiredRoles: RoleRequirement[]) {
  return requiredRoles.reduce((total, item) => total + item.count, 0);
}

function redirectBack(formData: FormData, fallback: string) {
  redirect(getRedirectTarget(formData, fallback));
}

function getRedirectTarget(formData: FormData, fallback: string) {
  return getString(formData, "redirectTo") || fallback;
}

function appendQueryParam(path: string, key: string, value: string) {
  const url = new URL(path, "https://work.local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function redirectBackWithQuery(formData: FormData, fallback: string, key: string, value: string) {
  redirect(appendQueryParam(getRedirectTarget(formData, fallback), key, value));
}

function revalidateDataTags(...tags: DataTag[]) {
  for (const tag of new Set(tags)) {
    revalidateTag(tag);
  }
}

function resolveRequiredRoles(formData: FormData, fallback: RoleRequirement[]) {
  const explicit = parseRoleRequirements(formData);
  return explicit.length > 0 ? explicit : fallback;
}

async function safeUpsertCalendarEvent(userId: string, shiftId: string) {
  try {
    await upsertGoogleCalendarEventForAssignment(userId, shiftId);
    revalidateDataTags("calendar_syncs");
  } catch (error) {
    console.error("calendar.upsert_failed", { userId, shiftId, error });
  }
}

async function safeDeleteCalendarEvent(userId: string, shiftId: string) {
  try {
    await deleteGoogleCalendarEventForAssignment(userId, shiftId);
    revalidateDataTags("calendar_syncs");
  } catch (error) {
    console.error("calendar.delete_failed", { userId, shiftId, error });
  }
}

async function safeSyncCalendarForShift(shiftId: string) {
  try {
    await syncGoogleCalendarForShift(shiftId);
    revalidateDataTags("calendar_syncs");
  } catch (error) {
    console.error("calendar.shift_sync_failed", { shiftId, error });
  }
}

async function safeDeleteCalendarEventsForShift(shiftId: string) {
  const assignments = await assignmentsService.forShift(shiftId);
  for (const assignment of assignments) {
    await safeDeleteCalendarEvent(assignment.userId, shiftId);
  }
}

async function safeDisconnectCalendarForUser(userId: string) {
  const assignments = await assignmentsService.forUser(userId);
  for (const assignment of assignments) {
    await safeDeleteCalendarEvent(userId, assignment.shiftId);
  }
  const connection = await calendarConnectionsService.findGoogleByUser(userId);
  if (connection) {
    await calendarConnectionsService.delete(connection.id);
  }
  const syncRows = await calendarSyncsService.forUser(userId);
  for (const row of syncRows) {
    await calendarSyncsService.delete(row.id);
  }
  revalidateDataTags("calendar_connections", "calendar_syncs");
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

export async function loginWorkAction(formData: FormData) {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const user = await usersService.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash) || !user.active) {
    redirect(`${workPaths.login}?error=1`);
  }
  await setSessionCookie(user.id);
  if (isBaseRole(user.role)) {
    redirect(workPaths.base);
  }
  redirect(isManagerRole(user.role) ? workPaths.schedule : workPaths.employees);
}

export async function loginAdminAction(formData: FormData) {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const user = await usersService.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash) || !user.active || !isManagerRole(user.role)) {
    redirect(`${adminPaths.login}?error=1`);
  }
  await setSessionCookie(user.id);
  redirect(workPaths.schedule);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect(staffPaths.login);
}

export async function signupShiftAction(formData: FormData) {
  const user = await requireUser();
  if (!canUseWorkRole(user.role)) {
    redirect(staffPaths.adminSchedule);
  }
  const shiftId = getString(formData, "shiftId");
  const date = getString(formData, "date");
  const role: StaffRole = user.preferredRoles[0] ?? "plac";
  const assignment = await shiftsService.signup(shiftId, user, role);
  if (assignment.status === "confirmed") {
    await safeUpsertCalendarEvent(user.id, shiftId);
  }
  revalidateDataTags("assignments", "shifts", "calendar_syncs");
  revalidatePath(staffPaths.employees);
  revalidatePath(staffPaths.employeeDay(date));
  revalidatePath(staffPaths.employeesMy);
}

export async function unassignShiftAction(formData: FormData) {
  const user = await requireUser();
  if (!canUseWorkRole(user.role)) {
    redirect(staffPaths.adminSchedule);
  }
  const shiftId = getString(formData, "shiftId");
  const date = getString(formData, "date");
  await shiftsService.unassign(shiftId, user.id);
  await safeDeleteCalendarEvent(user.id, shiftId);
  revalidateDataTags("assignments", "shifts", "calendar_syncs");
  revalidatePath(staffPaths.employees);
  revalidatePath(staffPaths.employeeDay(date));
  revalidatePath(staffPaths.employeesMy);
}

export async function updateMyPreferencesAction(formData: FormData) {
  const user = await requireUser();
  const roles = getStringArray(formData, "preferredRoles").filter((role): role is StaffRole =>
    STAFF_ROLES.includes(role as StaffRole),
  );
  const excludedRoles = getStringArray(formData, "excludedRoles").filter((role): role is StaffRole =>
    STAFF_ROLES.includes(role as StaffRole),
  );
  const workPeriods = getStringArray(formData, "workPeriods").filter((value): value is WorkPeriod =>
    WORK_PERIODS.includes(value as WorkPeriod),
  );
  const workDayPreferences = getStringArray(formData, "workDayPreferences").filter((value): value is WorkDayPreference =>
    WORK_DAY_PREFERENCES.includes(value as WorkDayPreference),
  );
  await usersService.update(user.id, {
    preferredRoles: roles,
    excludedRoles,
    workPeriods,
    workDayPreferences,
    onboardingCompleted: true,
  });
  revalidateDataTags("users");
  revalidatePath(staffPaths.employeesMy);
  revalidatePath(workPaths.profile);
  redirectBackWithQuery(formData, staffPaths.employeesMy, "saved", "preferences");
}

export async function updateMyAccountAction(formData: FormData) {
  const user = await requireUser({ loginPath: workPaths.login });
  const name = getString(formData, "name");
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const pin = normalizePinInput(getString(formData, "pin"));

  if (!name) {
    redirectBackWithQuery(formData, workPaths.profile, "error", "account_name");
  }
  if (!email || !email.includes("@")) {
    redirectBackWithQuery(formData, workPaths.profile, "error", "account_email");
  }

  const existing = await usersService.findByEmail(email);
  if (existing && existing.id !== user.id) {
    redirectBackWithQuery(formData, workPaths.profile, "error", "account_exists");
  }

  if (password && password.length < 6) {
    redirectBackWithQuery(formData, workPaths.profile, "error", "account_password");
  }
  if (pin && pin.length !== 4) {
    redirectBackWithQuery(formData, workPaths.profile, "error", "account_pin");
  }

  await usersService.update(user.id, {
    name,
    email,
    ...(password ? { passwordHash: hashPassword(password) } : {}),
    ...(pin ? { pinHash: hashPassword(pin) } : {}),
  });

  revalidateDataTags("users");
  revalidatePath(workPaths.profile);
  revalidatePath(staffPaths.employeesMy);
  revalidatePath(staffPaths.employees);
  redirectBackWithQuery(formData, workPaths.profile, "saved", "account");
}

export async function updateMyPhotoAction(formData: FormData) {
  const user = await requireUser({ loginPath: workPaths.login });
  const photo = formData.get("photo");

  if (!(photo instanceof File) || photo.size === 0) {
    return redirectBackWithQuery(formData, workPaths.profile, "error", "account_photo");
  }
  const uploadedPhoto = photo;
  if (!uploadedPhoto.type.startsWith("image/")) {
    return redirectBackWithQuery(formData, workPaths.profile, "error", "account_photo_type");
  }
  if (uploadedPhoto.size > 1_500_000) {
    return redirectBackWithQuery(formData, workPaths.profile, "error", "account_photo_size");
  }

  const fileBuffer = await uploadedPhoto.arrayBuffer();
  const uploadedToR2 = await uploadUserPhoto({
    userId: user.id,
    bytes: fileBuffer,
    contentType: uploadedPhoto.type,
  });

  if (uploadedToR2) {
    await usersService.update(user.id, {
      photoKey: uploadedToR2.key,
      photoContentType: uploadedToR2.contentType,
      photoDataUrl: undefined,
    });
  } else {
    const bytes = Buffer.from(fileBuffer).toString("base64");
    const photoDataUrl = `data:${uploadedPhoto.type};base64,${bytes}`;
    await usersService.update(user.id, {
      photoDataUrl,
      photoKey: undefined,
      photoContentType: uploadedPhoto.type,
    });
  }
  revalidateDataTags("users");
  revalidatePath(workPaths.profile);
  revalidatePath(workPaths.people);
  revalidatePath(workPaths.approvals);
  redirectBackWithQuery(formData, workPaths.profile, "saved", "photo");
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
  const presetDefinition = preset ? await shiftPresetsService.findById(preset) : null;
  const fallbackType: ShiftType = SHIFT_TYPES.includes(rawType) ? rawType : "restaurant";
  const dateFrom = getString(formData, "dateFrom") || getString(formData, "date");
  const dateTo = getString(formData, "dateTo") || dateFrom;
  const customDates = parseCustomDates(getString(formData, "customDates"));
  const targetDates =
    customDates.length > 0 ? customDates : enumerateDates(dateFrom, dateTo, parseWeekdaySet(formData));
  const baseTimes = defaultShiftTimes(
    fallbackType,
    getString(formData, "startTime"),
    getString(formData, "endTime"),
  );
  const merged = presetDefinition
    ? {
        locationId: presetDefinition.locationId,
        type: presetDefinition.type,
        startTime: presetDefinition.startTime,
        endTime: presetDefinition.endTime,
        notes: presetDefinition.notes,
      }
    : {
        locationId: "",
        type: fallbackType,
        startTime: baseTimes.startTime,
        endTime: baseTimes.endTime,
        notes: getString(formData, "notes"),
      };
  const locationId = getString(formData, "locationId") || merged.locationId;
  const endTime = isFlexibleEndTime(formData) ? "dle situace" : merged.endTime;
  const requiredRoles = resolveRequiredRoles(formData, presetDefinition?.requiredRoles ?? []);
  const minimumPeople = sumRoleRequirements(requiredRoles);
  const requiresApproval = getString(formData, "requiresApproval") === "on";

  for (const date of targetDates.length ? targetDates : [dateFrom]) {
    if (!date) continue;
    await upsertShiftForDate({
      date,
      startTime: merged.startTime,
      endTime,
      locationId,
      type: merged.type,
      requiredRoles,
      minimumPeople,
      requiresApproval,
      notes: merged.notes || undefined,
    });
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
  const assignment = await assignmentsService.findById(assignmentId);
  const shift = assignment ? await shiftsService.findById(assignment.shiftId) : null;
  await assignmentsService.setStatus(assignmentId, status);
  if (assignment) {
    if (status === "confirmed") {
      await safeUpsertCalendarEvent(assignment.userId, assignment.shiftId);
    } else {
      await safeDeleteCalendarEvent(assignment.userId, assignment.shiftId);
    }
  }
  revalidateDataTags("assignments", "calendar_syncs");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  revalidatePath(workPaths.approvals);
  if (shift?.date) revalidatePath(staffPaths.employeeDay(shift.date));
  redirectBack(formData, staffPaths.adminSchedule);
}

export async function removeAssignmentAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const assignmentId = getString(formData, "assignmentId");
  const date = getString(formData, "date");
  if (!assignmentId) redirect(staffPaths.adminSchedule);
  const assignment = await assignmentsService.findById(assignmentId);
  await assignmentsService.delete(assignmentId);
  if (assignment) {
    await safeDeleteCalendarEvent(assignment.userId, assignment.shiftId);
  }
  revalidateDataTags("assignments", "calendar_syncs");
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
  const requestedRole = getString(formData, "staffRole");
  const staffRole = STAFF_ROLES.includes(requestedRole as StaffRole)
    ? (requestedRole as StaffRole)
    : user.preferredRoles[0] ?? "plac";
  await shiftsService.signup(shiftId, user, staffRole, "confirmed");
  await safeUpsertCalendarEvent(user.id, shiftId);
  revalidateDataTags("assignments", "shifts", "calendar_syncs");
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
  const notes = getString(formData, "notes");
  const requiresApproval = getString(formData, "requiresApproval") === "on";
  const requiredRoles = resolveRequiredRoles(formData, shift.requiredRoles);
  const minimumPeople = sumRoleRequirements(requiredRoles);

  await shiftsService.update(shiftId, {
    date: nextDate,
    type: nextType,
    startTime,
    endTime,
    locationId,
    requiredRoles,
    minimumPeople,
    requiresApproval,
    notes: notes || undefined,
  });
  await safeSyncCalendarForShift(shiftId);

  revalidateDataTags("shifts", "calendar_syncs");
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
  await safeDeleteCalendarEventsForShift(shiftId);
  await shiftsService.deleteCascade(shiftId);
  revalidateDataTags("shifts", "assignments", "calendar_syncs");
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  if (date) revalidatePath(staffPaths.employeeDay(date));
  redirectBack(formData, staffPaths.adminScheduleWithParams({ tab: "admin", date: date || undefined }));
}

export async function createLocationAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
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

export async function createShiftPresetAction(formData: FormData) {
  const manager = await requireRoles(["manager", "admin"]);
  const rawType = getString(formData, "type") as ShiftType;
  const type: ShiftType = SHIFT_TYPES.includes(rawType) ? rawType : "restaurant";
  const startTime = normalizeTimeInput(getString(formData, "startTime")) || defaultShiftTimes(type, "", "").startTime;
  const endTime = isFlexibleEndTime(formData)
    ? "dle situace"
    : normalizeTimeInput(getString(formData, "endTime")) || defaultShiftTimes(type, "", "").endTime;
  const locationId = getString(formData, "locationId");
  if (!locationId) redirect(staffPaths.employees);
  await shiftPresetsService.create({
    name: getString(formData, "name"),
    description: getString(formData, "description") || undefined,
    locationId,
    type,
    startTime,
    endTime,
    requiredRoles: parseRoleRequirements(formData),
    notes: getString(formData, "notes") || undefined,
    createdByUserId: manager.id,
  });
  revalidateDataTags("shift_presets");
  revalidatePath(staffPaths.employees);
  redirectBackWithQuery(formData, staffPaths.employees, "presetCreated", "1");
}

export async function deleteShiftPresetAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const presetId = getString(formData, "presetId");
  if (!presetId) redirect(staffPaths.employees);
  await shiftPresetsService.delete(presetId);
  revalidateDataTags("shift_presets");
  revalidatePath(staffPaths.employees);
  redirectBackWithQuery(formData, staffPaths.employees, "presetDeleted", "1");
}

export async function updateLocationAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
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
  const manager = await requireRoles(["manager", "admin"]);
  const role = getString(formData, "role") as AppRole;
  if (!APP_ROLES.includes(role) || !getAssignableRoles(manager.role).includes(role)) redirect(staffPaths.adminPeople);
  const locationIds = getStringArray(formData, "locationIds");
  const password = getString(formData, "password");
  const pin = normalizePinInput(getString(formData, "pin"));
  await usersService.create({
    name: getString(formData, "name"),
    email: getString(formData, "email"),
    passwordHash: hashPassword(password || "heslo123"),
    pinHash: pin.length === 4 ? hashPassword(pin) : undefined,
    role,
    active: true,
    locationIds,
    preferredRoles: [],
    excludedRoles: [],
    workPeriods: [],
    workDayPreferences: [],
    onboardingCompleted: false,
    availabilityByDate: {},
  });
  revalidateDataTags("users");
  revalidatePath(staffPaths.adminPeople);
  redirect(staffPaths.adminPeople);
}

export async function createInviteAction(formData: FormData) {
  const manager = await requireRoles(["manager", "admin"]);
  const role = getString(formData, "role") as AppRole;
  const label = getString(formData, "label");
  const position = getString(formData, "position");
  if (!APP_ROLES.includes(role) || !getAssignableRoles(manager.role).includes(role)) redirect(staffPaths.adminPeople);

  const locationIds = getStringArray(formData, "locationIds");
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString();
  await invitesService.create({
    token,
    label: label || undefined,
    position: position || undefined,
    role,
    locationIds,
    createdByUserId: manager.id,
    expiresAt,
    reusable: true,
    useCount: 0,
    note: getString(formData, "note") || undefined,
  });
  revalidateDataTags("invites");
  revalidatePath(staffPaths.adminPeople);
  redirect(`${staffPaths.adminPeople}?inviteCreated=1`);
}

export async function deleteInviteAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const inviteId = getString(formData, "inviteId");
  if (!inviteId) redirect(staffPaths.adminPeople);
  await invitesService.delete(inviteId);
  revalidateDataTags("invites");
  revalidatePath(staffPaths.adminPeople);
  redirect(staffPaths.adminPeople);
}

export async function completeInviteAction(formData: FormData) {
  const token = getString(formData, "token");
  const invite = await invitesService.findByToken(token);
  const overLimit = typeof invite?.maxUses === "number" && invite.useCount >= invite.maxUses;
  if (!invite || invite.expiresAt < nowIso() || overLimit) {
    redirect("/work?error=invite");
  }

  const email = (invite.email || getString(formData, "email")).toLowerCase();
  if (!email) {
    redirect(`/work/join/${token}?error=email`);
  }

  const existingUser = await usersService.findByEmail(email);
  if (existingUser) {
    redirect(`/work/join/${token}?error=exists`);
  }

  const password = getString(formData, "password");
  const pin = normalizePinInput(getString(formData, "pin"));
  const preferredRoles = getStringArray(formData, "preferredRoles").filter((role): role is StaffRole =>
    STAFF_ROLES.includes(role as StaffRole),
  );
  const excludedRoles = getStringArray(formData, "excludedRoles").filter((role): role is StaffRole =>
    STAFF_ROLES.includes(role as StaffRole),
  );
  const workPeriods = getStringArray(formData, "workPeriods").filter((value): value is WorkPeriod =>
    WORK_PERIODS.includes(value as WorkPeriod),
  );
  const workDayPreferences = getStringArray(formData, "workDayPreferences").filter((value): value is WorkDayPreference =>
    WORK_DAY_PREFERENCES.includes(value as WorkDayPreference),
  );

  if (!password || password.length < 6) {
    redirect(`/work/join/${token}?error=password`);
  }
  if (pin.length !== 4) {
    redirect(`/work/join/${token}?error=pin`);
  }

  const user = await usersService.create({
    name: getString(formData, "name"),
    email,
    passwordHash: hashPassword(password),
    pinHash: hashPassword(pin),
    role: invite.role,
    active: true,
    locationIds: invite.locationIds,
    preferredRoles,
    excludedRoles,
    workPeriods,
    workDayPreferences,
    onboardingCompleted: true,
    availabilityByDate: {},
  });
  await invitesService.update(invite.id, {
    usedAt: nowIso(),
    useCount: invite.useCount + 1,
  });
  revalidateDataTags("users", "invites");
  await setSessionCookie(user.id);
  redirect(`${workPaths.employees}?welcome=1`);
}

export async function updateUserRoleAction(formData: FormData) {
  const manager = await requireRoles(["manager", "admin"]);
  const userId = getString(formData, "userId");
  const role = getString(formData, "role") as AppRole;
  if (!userId || !APP_ROLES.includes(role) || !getAssignableRoles(manager.role).includes(role)) {
    redirect(staffPaths.adminPeople);
  }
  const targetUser = await usersService.findById(userId);
  if (!targetUser || !canManageUserAccount(manager.role, targetUser.role)) {
    redirect(staffPaths.adminPeople);
  }
  await usersService.update(userId, { role });
  revalidateDataTags("users");
  revalidatePath(staffPaths.adminPeople);
  redirect(staffPaths.adminPeople);
}

export async function updateUserPasswordAction(formData: FormData) {
  const manager = await requireRoles(["manager", "admin"]);
  const userId = getString(formData, "userId");
  const password = getString(formData, "password");
  if (!userId || password.length < 6) redirect(staffPaths.adminPeople);
  const targetUser = await usersService.findById(userId);
  if (!targetUser || !canManageUserAccount(manager.role, targetUser.role)) {
    redirect(staffPaths.adminPeople);
  }
  await usersService.update(userId, { passwordHash: hashPassword(password) });
  revalidateDataTags("users");
  revalidatePath(staffPaths.adminPeople);
  redirect(staffPaths.adminPeople);
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireRoles(["manager", "admin"]);
  const userId = getString(formData, "userId");
  if (!userId || userId === admin.id) redirect(staffPaths.adminPeople);
  const targetUser = await usersService.findById(userId);
  if (!targetUser || !canManageUserAccount(admin.role, targetUser.role)) {
    redirect(staffPaths.adminPeople);
  }
  await safeDisconnectCalendarForUser(userId);
  await baseAttendanceService.deleteForUser(userId);
  await assignmentsService.deleteForUser(userId);
  await usersService.delete(userId);
  revalidateDataTags("users", "assignments", "base_attendance", "calendar_connections", "calendar_syncs");
  revalidatePath(staffPaths.adminPeople);
  revalidatePath(staffPaths.adminSchedule);
  revalidatePath(staffPaths.employees);
  redirect(staffPaths.adminPeople);
}

export async function updateBaseAttendanceAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const recordId = getString(formData, "recordId");
  if (!recordId) redirectBack(formData, workPaths.base);

  const clockInAt = normalizeDateTimeLocalInput(getString(formData, "clockInAt"));
  const clockOutAtRaw = getString(formData, "clockOutAt");
  const clockOutAt = normalizeDateTimeLocalInput(clockOutAtRaw);
  const clockInLocationId = getString(formData, "clockInLocationId");
  const clockOutLocationId = getString(formData, "clockOutLocationId") || clockInLocationId;

  if (!clockInAt || !clockInLocationId) redirectBack(formData, workPaths.base);
  if (clockOutAt && new Date(clockOutAt).getTime() < new Date(clockInAt).getTime()) redirectBack(formData, workPaths.base);

  await baseAttendanceService.update(recordId, {
    clockInAt,
    clockOutAt: clockOutAt || undefined,
    clockInLocationId,
    clockOutLocationId: clockOutAt ? clockOutLocationId : undefined,
  });
  revalidateDataTags("base_attendance");
  revalidatePath(workPaths.base);
  redirectBack(formData, workPaths.base);
}

export async function deleteBaseAttendanceAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const recordId = getString(formData, "recordId");
  if (!recordId) redirectBack(formData, workPaths.base);
  await baseAttendanceService.delete(recordId);
  revalidateDataTags("base_attendance");
  revalidatePath(workPaths.base);
  redirectBack(formData, workPaths.base);
}

export async function deleteBaseAttendanceBulkAction(formData: FormData) {
  await requireRoles(["manager", "admin"]);
  const recordIds = getStringArray(formData, "recordIds");
  if (recordIds.length === 0) redirectBack(formData, workPaths.base);
  for (const recordId of new Set(recordIds)) {
    await baseAttendanceService.delete(recordId);
  }
  revalidateDataTags("base_attendance");
  revalidatePath(workPaths.base);
  redirectBack(formData, workPaths.base);
}

export async function disconnectGoogleCalendarAction(formData: FormData) {
  const user = await requireUser({ loginPath: workPaths.login });
  await safeDisconnectCalendarForUser(user.id);
  revalidatePath(staffPaths.employeesMy);
  revalidatePath(workPaths.profile);
  redirectBackWithQuery(formData, staffPaths.employeesMy, "google", "disconnected");
}
