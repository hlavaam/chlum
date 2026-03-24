export type AppRole = "brigadnik" | "manager" | "admin" | "superadmin";
export type ShiftType = "restaurant" | "wedding" | "event";
export type EventType = "wedding" | "event";
export type StaffRole = "plac" | "kitchen" | "cleaning";
export type AssignmentStatus = "confirmed" | "pending";
export type AvailabilityStatus = "available" | "preferred" | "unavailable";
export type WorkPeriod = "before_summer" | "summer";
export type WorkDayPreference = "weekends" | "weekdays";
export type CalendarProvider = "google";
export type CalendarSyncStatus = "active" | "deleted";

export interface DailyMenuItem {
  category: string;
  name: string;
  price: string;
  allergens: string;
}

export interface DailyMenuDayRecord {
  title: string;
  note: string;
  items: DailyMenuItem[];
  updatedAt: string;
}

export interface DailyMenuRecord extends BaseRecord, DailyMenuDayRecord {
  date: string;
}

export interface DailyMenuStore {
  days: Record<string, DailyMenuDayRecord>;
}

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleRequirement {
  role: StaffRole;
  count: number;
}

export interface UserRecord extends BaseRecord {
  name: string;
  email: string;
  passwordHash: string;
  role: AppRole;
  active: boolean;
  locationIds: string[];
  preferredRoles: StaffRole[];
  excludedRoles: StaffRole[];
  workPeriods: WorkPeriod[];
  workDayPreferences: WorkDayPreference[];
  onboardingCompleted: boolean;
  availabilityByDate: Record<string, AvailabilityStatus>;
}

export interface LocationRecord extends BaseRecord {
  name: string;
  code: string;
  address: string;
}

export interface EventRecord extends BaseRecord {
  name: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  locationId: string;
  requiredRoles: RoleRequirement[];
  minimumPeople: number;
  notes?: string;
  shiftId?: string;
}

export interface ShiftRecord extends BaseRecord {
  date: string;
  startTime: string;
  endTime: string;
  locationId: string;
  type: ShiftType;
  requiredRoles: RoleRequirement[];
  minimumPeople: number;
  requiresApproval: boolean;
  notes?: string;
  eventId?: string;
}

export interface ShiftPresetRecord extends BaseRecord {
  name: string;
  description?: string;
  locationId: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  requiredRoles: RoleRequirement[];
  notes?: string;
  createdByUserId: string;
}

export interface AssignmentRecord extends BaseRecord {
  shiftId: string;
  userId: string;
  staffRole: StaffRole;
  status: AssignmentStatus;
  notes?: string;
}

export interface InviteRecord extends BaseRecord {
  token: string;
  email?: string;
  label?: string;
  role: AppRole;
  locationIds: string[];
  createdByUserId: string;
  expiresAt: string;
  reusable: boolean;
  useCount: number;
  maxUses?: number;
  usedAt?: string;
  note?: string;
}

export interface CalendarConnectionRecord extends BaseRecord {
  userId: string;
  provider: CalendarProvider;
  calendarId: string;
  calendarEmail?: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  scope?: string;
}

export interface CalendarSyncRecord extends BaseRecord {
  userId: string;
  shiftId: string;
  connectionId: string;
  eventId: string;
  status: CalendarSyncStatus;
  syncedAt: string;
}

export type ResourceName =
  | "users"
  | "locations"
  | "events"
  | "shifts"
  | "shift_presets"
  | "assignments"
  | "invites"
  | "calendar_connections"
  | "calendar_syncs";

export type RecordByResource = {
  users: UserRecord;
  locations: LocationRecord;
  events: EventRecord;
  shifts: ShiftRecord;
  shift_presets: ShiftPresetRecord;
  assignments: AssignmentRecord;
  invites: InviteRecord;
  calendar_connections: CalendarConnectionRecord;
  calendar_syncs: CalendarSyncRecord;
};
