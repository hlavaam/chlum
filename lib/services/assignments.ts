import { BaseCrudService } from "@/lib/services/base-crud";
import { loadResourceByField, loadResourceByFieldIn } from "@/lib/storage/resource-queries";
import { assignmentsRepository } from "@/lib/storage/repositories";
import type { AssignmentRecord, AssignmentStatus } from "@/types/models";

class AssignmentsService extends BaseCrudService<AssignmentRecord> {
  async forShift(shiftId: string) {
    return loadResourceByField<AssignmentRecord>(
      "assignments",
      "shiftId",
      shiftId,
      () => this.loadAll(),
    );
  }

  async forShiftIds(shiftIds: string[]) {
    return loadResourceByFieldIn<AssignmentRecord>(
      "assignments",
      "shiftId",
      shiftIds,
      () => this.loadAll(),
    );
  }

  async forUser(userId: string) {
    return loadResourceByField<AssignmentRecord>(
      "assignments",
      "userId",
      userId,
      () => this.loadAll(),
    );
  }

  async setStatus(id: string, status: AssignmentStatus) {
    return this.update(id, { status });
  }

  async deleteForShift(shiftId: string) {
    const items = await this.forShift(shiftId);
    let deleted = 0;
    for (const item of items) {
      const ok = await this.delete(item.id);
      if (ok) deleted += 1;
    }
    return deleted;
  }

  async deleteForUser(userId: string) {
    const items = await this.forUser(userId);
    let deleted = 0;
    for (const item of items) {
      const ok = await this.delete(item.id);
      if (ok) deleted += 1;
    }
    return deleted;
  }
}

export const assignmentsService = new AssignmentsService(assignmentsRepository);
