import { BaseCrudService } from "@/lib/services/base-crud";
import { locationsRepository } from "@/lib/storage/repositories";
import type { LocationRecord } from "@/types/models";

class LocationsService extends BaseCrudService<LocationRecord> {}

export const locationsService = new LocationsService(locationsRepository);
