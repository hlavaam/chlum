import type {
  AppRole,
  AvailabilityStatus,
  EventType,
  ShiftType,
  StaffRole,
  WorkDayPreference,
  WorkPeriod,
} from "@/types/models";

export const APP_ROLES: AppRole[] = ["brigadnik", "base", "manager", "admin", "superadmin"];
export const STAFF_ROLES: StaffRole[] = ["plac", "kitchen", "cleaning"];
export const SHIFT_TYPES: ShiftType[] = ["restaurant", "wedding", "event"];
export const EVENT_TYPES: EventType[] = ["wedding", "event"];
export const AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  "available",
  "preferred",
  "unavailable",
];
export const WORK_PERIODS: WorkPeriod[] = ["before_summer", "summer"];
export const WORK_DAY_PREFERENCES: WorkDayPreference[] = ["weekends", "weekdays"];

export const roleLabels: Record<AppRole, string> = {
  brigadnik: "Brigádník",
  base: "Základna",
  manager: "Manažer",
  admin: "Admin",
  superadmin: "Super admin",
};

export const staffRoleLabels: Record<StaffRole, string> = {
  plac: "Plac",
  kitchen: "Kuchyň",
  cleaning: "Úklid",
};

export const shiftTypeLabels: Record<ShiftType, string> = {
  restaurant: "Restaurace",
  wedding: "Svatba",
  event: "Event",
};

export const eventTypeLabels: Record<EventType, string> = {
  wedding: "Svatba",
  event: "Event",
};

export const availabilityLabels: Record<AvailabilityStatus, string> = {
  available: "Mohu",
  preferred: "Preferuji",
  unavailable: "Nemohu",
};

export const workPeriodLabels: Record<WorkPeriod, string> = {
  before_summer: "I před prázdninami",
  summer: "Hlavně o prázdninách",
};

export const workDayPreferenceLabels: Record<WorkDayPreference, string> = {
  weekends: "Spíš víkendy",
  weekdays: "Spíš týden",
};
