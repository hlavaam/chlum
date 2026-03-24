import { BaseCrudService } from "@/lib/services/base-crud";
import { shiftPresetsRepository } from "@/lib/storage/repositories";
import type { ShiftPresetRecord } from "@/types/models";

class ShiftPresetsService extends BaseCrudService<ShiftPresetRecord> {}

export const shiftPresetsService = new ShiftPresetsService(shiftPresetsRepository);
