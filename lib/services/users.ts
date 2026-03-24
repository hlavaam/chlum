import { BaseCrudService } from "@/lib/services/base-crud";
import { usersRepository } from "@/lib/storage/repositories";
import type {
  AvailabilityStatus,
  StaffRole,
  UserRecord,
  WorkDayPreference,
  WorkPeriod,
} from "@/types/models";

const STAFF_ROLE_ALIASES: Record<string, StaffRole> = {
  plac: "plac",
  service: "plac",
  bar: "plac",
  runner: "plac",
  kitchen: "kitchen",
  cleaning: "cleaning",
  uklid: "cleaning",
};

function normalizeStaffRoles(values: string[] | undefined): StaffRole[] {
  const normalized = (values ?? [])
    .map((value) => STAFF_ROLE_ALIASES[String(value).toLowerCase()])
    .filter((value): value is StaffRole => Boolean(value));
  return [...new Set(normalized)];
}

function normalizeWorkPeriods(values: string[] | undefined): WorkPeriod[] {
  const allowed: WorkPeriod[] = ["before_summer", "summer"];
  return [...new Set((values ?? []).filter((value): value is WorkPeriod => allowed.includes(value as WorkPeriod)))];
}

function normalizeWorkDays(values: string[] | undefined): WorkDayPreference[] {
  const allowed: WorkDayPreference[] = ["weekends", "weekdays"];
  return [...new Set((values ?? []).filter((value): value is WorkDayPreference => allowed.includes(value as WorkDayPreference)))];
}

function normalizeUser(user: UserRecord): UserRecord {
  return {
    ...user,
    preferredRoles: normalizeStaffRoles(user.preferredRoles as string[]),
    excludedRoles: normalizeStaffRoles((user as Partial<UserRecord>).excludedRoles as string[]),
    workPeriods: normalizeWorkPeriods((user as Partial<UserRecord>).workPeriods as string[]),
    workDayPreferences: normalizeWorkDays((user as Partial<UserRecord>).workDayPreferences as string[]),
    onboardingCompleted: Boolean((user as Partial<UserRecord>).onboardingCompleted),
  };
}

class UsersService extends BaseCrudService<UserRecord> {
  constructor() {
    super(usersRepository);
  }

  async loadAll(): Promise<UserRecord[]> {
    const users = await super.loadAll();
    return users.map(normalizeUser);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await super.findById(id);
    return user ? normalizeUser(user) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const all = await this.loadAll();
    return all.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async updatePreferences(userId: string, preferredRoles: StaffRole[]) {
    return this.update(userId, { preferredRoles });
  }

  async updateAvailability(userId: string, date: string, status: AvailabilityStatus) {
    const user = await this.findById(userId);
    if (!user) return null;
    const nextAvailability = { ...user.availabilityByDate, [date]: status };
    return this.update(userId, { availabilityByDate: nextAvailability });
  }
}

export const usersService = new UsersService();
