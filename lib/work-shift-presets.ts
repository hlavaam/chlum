import type { RoleRequirement, ShiftType } from "@/types/models";

export type WorkShiftPresetKey =
  | "restaurant_lunch"
  | "restaurant_standard"
  | "restaurant_weekend"
  | "wedding_day"
  | "event_evening";

export type WorkShiftPreset = {
  key: WorkShiftPresetKey;
  label: string;
  description: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  minimumPeople: number;
  notes: string;
  requiredRoles: RoleRequirement[];
};

export const WORK_SHIFT_PRESETS: WorkShiftPreset[] = [];

const presetMap = new Map(WORK_SHIFT_PRESETS.map((preset) => [preset.key, preset]));

export function findWorkShiftPreset(key: string) {
  return presetMap.get(key as WorkShiftPresetKey) ?? null;
}
