import { BaseCrudService } from "@/lib/services/base-crud";
import { assignmentsService } from "@/lib/services/assignments";
import {
  loadResourceByField,
  loadResourceByFieldRange,
  loadResourceByIds,
} from "@/lib/storage/resource-queries";
import { assignmentsRepository, shiftsRepository } from "@/lib/storage/repositories";
import type {
  AssignmentRecord,
  AssignmentStatus,
  ShiftRecord,
  StaffRole,
  UserRecord,
} from "@/types/models";

class ShiftsService extends BaseCrudService<ShiftRecord> {
  async forDate(date: string) {
    const rows = await loadResourceByField<ShiftRecord>("shifts", "date", date, () => this.loadAll());
    return rows
      .sort((a, b) => `${a.startTime}${a.endTime}`.localeCompare(`${b.startTime}${b.endTime}`));
  }

  async forDateRange(startDate: string, endDate: string) {
    const rows = await loadResourceByFieldRange<ShiftRecord>("shifts", "date", startDate, endDate, () => this.loadAll());
    return rows
      .sort((a, b) =>
        `${a.date}${a.startTime}${a.endTime}`.localeCompare(`${b.date}${b.startTime}${b.endTime}`),
      );
  }

  async forIds(ids: string[]) {
    return loadResourceByIds<ShiftRecord>("shifts", ids, () => this.loadAll());
  }

  async signup(
    shiftId: string,
    user: UserRecord,
    staffRole: StaffRole,
    forceStatus?: AssignmentStatus,
  ): Promise<AssignmentRecord> {
    const shift = await this.findById(shiftId);
    if (!shift) throw new Error("Shift not found");
    const existing = (await assignmentsService.forShift(shiftId)).find(
      (a) => a.userId === user.id,
    );
    if (existing) return existing;
    const status: AssignmentStatus = forceStatus ?? (shift.requiresApproval ? "pending" : "confirmed");
    return assignmentsRepository.create({
      shiftId,
      userId: user.id,
      staffRole,
      status,
    });
  }

  async unassign(shiftId: string, userId: string): Promise<boolean> {
    const assignments = await assignmentsService.forShift(shiftId);
    const target = assignments.find((a) => a.userId === userId);
    if (!target) return false;
    return assignmentsRepository.delete(target.id);
  }

  async occupancy(shiftId: string) {
    const assignments = await assignmentsService.forShift(shiftId);
    const confirmed = assignments.filter((a) => a.status === "confirmed").length;
    const pending = assignments.filter((a) => a.status === "pending").length;
    return { confirmed, pending, total: assignments.length };
  }

  async deleteCascade(shiftId: string) {
    await assignmentsService.deleteForShift(shiftId);
    return this.delete(shiftId);
  }
}

export const shiftsService = new ShiftsService(shiftsRepository);
