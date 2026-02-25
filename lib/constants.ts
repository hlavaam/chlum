import type { AppRole, AvailabilityStatus, EventType, ShiftType, StaffRole } from "@/types/models";

export const APP_ROLES: AppRole[] = ["brigadnik", "manager", "admin"];
export const STAFF_ROLES: StaffRole[] = ["service", "bar", "kitchen", "runner"];
export const SHIFT_TYPES: ShiftType[] = ["restaurant", "wedding", "event"];
export const EVENT_TYPES: EventType[] = ["wedding", "event"];
export const AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  "available",
  "preferred",
  "unavailable",
];

export const roleLabels: Record<AppRole, string> = {
  brigadnik: "Brigádník",
  manager: "Manažer",
  admin: "Admin",
};

export const staffRoleLabels: Record<StaffRole, string> = {
  service: "Obsluha",
  bar: "Bar",
  kitchen: "Kuchyně",
  runner: "Runner",
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
