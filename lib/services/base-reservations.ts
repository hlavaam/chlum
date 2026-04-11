import { BaseCrudService } from "@/lib/services/base-crud";
import { baseReservationsRepository } from "@/lib/storage/repositories";
import { loadResourceByFieldRange } from "@/lib/storage/resource-queries";
import type { BaseReservationRecord } from "@/types/models";

class BaseReservationsService extends BaseCrudService<BaseReservationRecord> {
  constructor() {
    super(baseReservationsRepository);
  }

  async forDateRange(start: string, end: string) {
    return loadResourceByFieldRange<BaseReservationRecord>("base_reservations", "date", start, end, () => this.loadAll());
  }
}

export const baseReservationsService = new BaseReservationsService();
