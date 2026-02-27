import { BaseCrudService } from "@/lib/services/base-crud";
import {
  hasDatabaseUrl,
  loadPostgresResourceByField,
  loadPostgresResourceByFieldIn,
} from "@/lib/storage/postgres-db";
import { assignmentsRepository } from "@/lib/storage/repositories";
import type { AssignmentRecord, AssignmentStatus } from "@/types/models";

class AssignmentsService extends BaseCrudService<AssignmentRecord> {
  async forShift(shiftId: string) {
    if (hasDatabaseUrl()) {
      return loadPostgresResourceByField<AssignmentRecord>("assignments", "shiftId", shiftId);
    }
    const all = await this.loadAll();
    return all.filter((assignment) => assignment.shiftId === shiftId);
  }

  async forShiftIds(shiftIds: string[]) {
    if (shiftIds.length === 0) return [];
    if (hasDatabaseUrl()) {
      return loadPostgresResourceByFieldIn<AssignmentRecord>("assignments", "shiftId", shiftIds);
    }
    const shiftIdSet = new Set(shiftIds);
    const all = await this.loadAll();
    return all.filter((assignment) => shiftIdSet.has(assignment.shiftId));
  }

  async forUser(userId: string) {
    if (hasDatabaseUrl()) {
      return loadPostgresResourceByField<AssignmentRecord>("assignments", "userId", userId);
    }
    const all = await this.loadAll();
    return all.filter((assignment) => assignment.userId === userId);
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
}

export const assignmentsService = new AssignmentsService(assignmentsRepository);
