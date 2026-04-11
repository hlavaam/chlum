export type AppRole = "brigadnik" | "base" | "manager" | "admin" | "superadmin";
export type ShiftType = "restaurant" | "wedding" | "event";
export type EventType = "wedding" | "event";
export type StaffRole = "plac" | "kitchen" | "cleaning";
export type AssignmentStatus = "confirmed" | "pending";
export type AvailabilityStatus = "available" | "preferred" | "unavailable";
export type WorkPeriod = "before_summer" | "summer";
export type WorkDayPreference = "weekends" | "weekdays";
export type CalendarProvider = "google";
export type CalendarSyncStatus = "active" | "deleted";
export type BaseAttendanceMethod = "self" | "pin" | "password" | "qr";

export interface DailyMenuItem {
  category: string;
  name: string;
  price: string;
  allergens: string;
}

export interface DailyDrinkItem {
  name: string;
  description: string;
  price: string;
}

export interface DailyMenuDayRecord {
  title: string;
  note: string;
  items: DailyMenuItem[];
  drinks?: DailyDrinkItem[];
  updatedAt: string;
  isPublished?: boolean;
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

export interface HomepageSectionRecord extends BaseRecord {
  sectionKey: "about";
  eyebrow: string;
  title: string;
  points: string[];
  primaryImage: string;
  secondaryImage: string;
}

export interface OpeningHoursDay {
  key: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  short: string;
  label: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface SiteSettingsRecord extends BaseRecord {
  siteKey: "public";
  openingHours: OpeningHoursDay[];
}

export interface RoleRequirement {
  role: StaffRole;
  count: number;
  startTime?: string;
  endTime?: string;
  endTimeFlexible?: boolean;
}

export interface UserRecord extends BaseRecord {
  name: string;
  email: string;
  photoDataUrl?: string;
  photoKey?: string;
  photoContentType?: string;
  passwordHash: string;
  pinHash?: string;
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
  position?: string;
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

export interface BaseAttendanceRecord extends BaseRecord {
  userId: string;
  clockInAt: string;
  clockOutAt?: string;
  clockInLocationId: string;
  clockOutLocationId?: string;
  clockInMethod: BaseAttendanceMethod;
  clockOutMethod?: BaseAttendanceMethod;
}

export interface BaseReservationRecord extends BaseRecord {
  date: string;
  time: string;
  partySize: number;
  locationId: string;
  name?: string;
  notes?: string;
  createdByUserId: string;
}

export type TelegramReservationStep =
  | "delete_pick"
  | "delete_confirm"
  | "location"
  | "date"
  | "time"
  | "party_size"
  | "name"
  | "notes";

export type TelegramReservationMode = "create" | "delete";

export interface TelegramReservationSessionRecord extends BaseRecord {
  chatId: string;
  userId: string;
  mode: TelegramReservationMode;
  step: TelegramReservationStep;
  locationId?: string;
  date?: string;
  time?: string;
  partySize?: number;
  name?: string;
  notes?: string;
  reservationIds?: string[];
  selectedReservationId?: string;
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
  | "calendar_syncs"
  | "homepage_sections"
  | "site_settings"
  | "base_attendance"
  | "base_reservations"
  | "telegram_reservation_sessions";

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
  homepage_sections: HomepageSectionRecord;
  site_settings: SiteSettingsRecord;
  base_attendance: BaseAttendanceRecord;
  base_reservations: BaseReservationRecord;
  telegram_reservation_sessions: TelegramReservationSessionRecord;
};
