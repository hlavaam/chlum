import { BaseCrudService } from "@/lib/services/base-crud";
import { calendarSyncsRepository } from "@/lib/storage/repositories";
import { loadResourceByField, loadResourceByFieldIn } from "@/lib/storage/resource-queries";
import type { CalendarSyncRecord } from "@/types/models";

class CalendarSyncsService extends BaseCrudService<CalendarSyncRecord> {
  async forUser(userId: string) {
    return loadResourceByField<CalendarSyncRecord>("calendar_syncs", "userId", userId, () => this.loadAll());
  }

  async forShiftIds(shiftIds: string[]) {
    return loadResourceByFieldIn<CalendarSyncRecord>("calendar_syncs", "shiftId", shiftIds, () => this.loadAll());
  }

  async findByUserAndShift(userId: string, shiftId: string) {
    const rows = await this.forUser(userId);
    return rows.find((row) => row.shiftId === shiftId) ?? null;
  }
}

export const calendarSyncsService = new CalendarSyncsService(calendarSyncsRepository);
