import { BaseCrudService } from "@/lib/services/base-crud";
import { usersRepository } from "@/lib/storage/repositories";
import type { AvailabilityStatus, StaffRole, UserRecord } from "@/types/models";

class UsersService extends BaseCrudService<UserRecord> {
  constructor() {
    super(usersRepository);
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
