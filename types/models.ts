export type AppRole = "brigadnik" | "manager" | "admin";
export type ShiftType = "restaurant" | "wedding" | "event";
export type EventType = "wedding" | "event";
export type StaffRole = "service" | "bar" | "kitchen" | "runner";
export type AssignmentStatus = "confirmed" | "pending";
export type AvailabilityStatus = "available" | "preferred" | "unavailable";

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

export interface AssignmentRecord extends BaseRecord {
  shiftId: string;
  userId: string;
  staffRole: StaffRole;
  status: AssignmentStatus;
  notes?: string;
}

export type ResourceName =
  | "users"
  | "locations"
  | "events"
  | "shifts"
  | "assignments";

export type RecordByResource = {
  users: UserRecord;
  locations: LocationRecord;
  events: EventRecord;
  shifts: ShiftRecord;
  assignments: AssignmentRecord;
};
