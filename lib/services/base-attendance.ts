import { BaseCrudService } from "@/lib/services/base-crud";
import { baseAttendanceRepository } from "@/lib/storage/repositories";
import { loadResourceByField } from "@/lib/storage/resource-queries";
import type { BaseAttendanceMethod, BaseAttendanceRecord } from "@/types/models";

type PunchParams = {
  userId: string;
  locationId: string;
  method: BaseAttendanceMethod;
};

class BaseAttendanceService extends BaseCrudService<BaseAttendanceRecord> {
  constructor() {
    super(baseAttendanceRepository);
  }

  async forUser(userId: string) {
    return loadResourceByField<BaseAttendanceRecord>("base_attendance", "userId", userId, () => this.loadAll());
  }

  async active() {
    const records = await this.loadAll();
    return records
      .filter((record) => !record.clockOutAt)
      .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt));
  }

  async activeForUser(userId: string) {
    const records = await this.forUser(userId);
    return records
      .filter((record) => !record.clockOutAt)
      .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt))[0] ?? null;
  }

  async recent(limit = 40) {
    const records = await this.loadAll();
    return records
      .sort((a, b) => {
        const aKey = a.clockOutAt ?? a.clockInAt;
        const bKey = b.clockOutAt ?? b.clockInAt;
        return bKey.localeCompare(aKey);
      })
      .slice(0, limit);
  }

  async togglePunch(params: PunchParams) {
    const activeRecord = await this.activeForUser(params.userId);
    if (activeRecord) {
      return this.update(activeRecord.id, {
        clockOutAt: new Date().toISOString(),
        clockOutLocationId: params.locationId,
        clockOutMethod: params.method,
      });
    }

    return this.create({
      userId: params.userId,
      clockInAt: new Date().toISOString(),
      clockInLocationId: params.locationId,
      clockInMethod: params.method,
    });
  }

  async deleteForUser(userId: string) {
    const rows = await this.forUser(userId);
    let deleted = 0;
    for (const row of rows) {
      const ok = await this.delete(row.id);
      if (ok) deleted += 1;
    }
    return deleted;
  }
}

export const baseAttendanceService = new BaseAttendanceService();
