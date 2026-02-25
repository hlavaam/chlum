import { BaseCrudService } from "@/lib/services/base-crud";
import { assignmentsRepository } from "@/lib/storage/repositories";
import type { AssignmentRecord, AssignmentStatus } from "@/types/models";

class AssignmentsService extends BaseCrudService<AssignmentRecord> {
  async forShift(shiftId: string) {
    const all = await this.loadAll();
    return all.filter((assignment) => assignment.shiftId === shiftId);
  }

  async forUser(userId: string) {
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
