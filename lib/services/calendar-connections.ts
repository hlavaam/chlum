import { BaseCrudService } from "@/lib/services/base-crud";
import { calendarConnectionsRepository } from "@/lib/storage/repositories";
import { loadResourceByField } from "@/lib/storage/resource-queries";
import type { CalendarConnectionRecord } from "@/types/models";

class CalendarConnectionsService extends BaseCrudService<CalendarConnectionRecord> {
  async findGoogleByUser(userId: string) {
    const rows = await loadResourceByField<CalendarConnectionRecord>("calendar_connections", "userId", userId, () =>
      this.loadAll(),
    );
    return rows.find((row) => row.provider === "google") ?? null;
  }
}

export const calendarConnectionsService = new CalendarConnectionsService(calendarConnectionsRepository);
