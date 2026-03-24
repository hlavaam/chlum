import { shiftsService } from "@/lib/services/shifts";
import type { RoleRequirement, ShiftRecord, ShiftType } from "@/types/models";

export type ShiftUpsertInput = {
  date: string;
  startTime: string;
  endTime: string;
  locationId: string;
  type: ShiftType;
  requiredRoles: RoleRequirement[];
  minimumPeople: number;
  requiresApproval: boolean;
  notes?: string;
};

export async function upsertShiftForDate(input: ShiftUpsertInput): Promise<ShiftRecord> {
  const existing = (await shiftsService.loadAll()).find(
    (shift) => shift.date === input.date && shift.locationId === input.locationId,
  );

  if (existing) {
    const updated = await shiftsService.update(existing.id, input);
    return updated ?? existing;
  }

  return shiftsService.create(input);
}
