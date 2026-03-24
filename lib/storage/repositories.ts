import type {
  AssignmentRecord,
  BaseRecord,
  CalendarConnectionRecord,
  CalendarSyncRecord,
  EventRecord,
  InviteRecord,
  LocationRecord,
  ShiftPresetRecord,
  ShiftRecord,
  UserRecord,
} from "@/types/models";
import type { Repository } from "@/lib/storage/repository";
import { getStorageBackend } from "@/lib/storage/storage-backend";

async function createNodeRepository<T extends BaseRecord>(
  resource: string,
  filename: string,
): Promise<Repository<T>> {
  if (process.env.DATABASE_NEON_DATABASE_URL || process.env.DATABASE_URL) {
    const [{ JsonRepository }, { PostgresRepository }, { shouldFallbackToJsonStorage }] = await Promise.all([
      import("@/lib/storage/json-repository"),
      import("@/lib/storage/postgres-repository"),
      import("@/lib/storage/postgres-db"),
    ]);

    const postgres = new PostgresRepository<T>(resource, filename);
    const json = new JsonRepository<T>(filename);
    let fallbackToJson = false;

    return {
      async loadAll() {
        if (fallbackToJson) return json.loadAll();
        try {
          return await postgres.loadAll();
        } catch (error) {
          if (!shouldFallbackToJsonStorage(error)) throw error;
          fallbackToJson = true;
          return json.loadAll();
        }
      },
      async findById(id: string) {
        if (fallbackToJson) return json.findById(id);
        try {
          return await postgres.findById(id);
        } catch (error) {
          if (!shouldFallbackToJsonStorage(error)) throw error;
          fallbackToJson = true;
          return json.findById(id);
        }
      },
      async create(input) {
        if (fallbackToJson) return json.create(input);
        try {
          return await postgres.create(input);
        } catch (error) {
          if (!shouldFallbackToJsonStorage(error)) throw error;
          fallbackToJson = true;
          return json.create(input);
        }
      },
      async update(id: string, patch) {
        if (fallbackToJson) return json.update(id, patch);
        try {
          return await postgres.update(id, patch);
        } catch (error) {
          if (!shouldFallbackToJsonStorage(error)) throw error;
          fallbackToJson = true;
          return json.update(id, patch);
        }
      },
      async delete(id: string) {
        if (fallbackToJson) return json.delete(id);
        try {
          return await postgres.delete(id);
        } catch (error) {
          if (!shouldFallbackToJsonStorage(error)) throw error;
          fallbackToJson = true;
          return json.delete(id);
        }
      },
    };
  }

  const { JsonRepository } = await import("@/lib/storage/json-repository");
  return new JsonRepository<T>(filename);
}

export class AdaptiveRepository<T extends BaseRecord> implements Repository<T> {
  private backendPromise: Promise<Repository<T>> | null = null;

  constructor(
    private readonly resource: string,
    private readonly filename: string,
  ) {}

  private async getBackend(): Promise<Repository<T>> {
    if (!this.backendPromise) {
      this.backendPromise = (async () => {
        const backend = await getStorageBackend();
        if (backend === "d1") {
          const { D1Repository } = await import("@/lib/storage/d1-repository");
          return new D1Repository<T>(this.resource);
        }
        return createNodeRepository<T>(this.resource, this.filename);
      })();
    }
    return this.backendPromise;
  }

  async loadAll() {
    return (await this.getBackend()).loadAll();
  }

  async findById(id: string) {
    return (await this.getBackend()).findById(id);
  }

  async create(input: Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>) {
    return (await this.getBackend()).create(input);
  }

  async update(id: string, patch: Partial<Omit<T, keyof BaseRecord>>) {
    return (await this.getBackend()).update(id, patch);
  }

  async delete(id: string) {
    return (await this.getBackend()).delete(id);
  }
}

export const usersRepository = new AdaptiveRepository<UserRecord>("users", "users.json");
export const locationsRepository = new AdaptiveRepository<LocationRecord>("locations", "locations.json");
export const eventsRepository = new AdaptiveRepository<EventRecord>("events", "events.json");
export const shiftsRepository = new AdaptiveRepository<ShiftRecord>("shifts", "shifts.json");
export const shiftPresetsRepository = new AdaptiveRepository<ShiftPresetRecord>("shift_presets", "shift-presets.json");
export const assignmentsRepository = new AdaptiveRepository<AssignmentRecord>("assignments", "assignments.json");
export const invitesRepository = new AdaptiveRepository<InviteRecord>("invites", "invites.json");
export const calendarConnectionsRepository = new AdaptiveRepository<CalendarConnectionRecord>(
  "calendar_connections",
  "calendar-connections.json",
);
export const calendarSyncsRepository = new AdaptiveRepository<CalendarSyncRecord>(
  "calendar_syncs",
  "calendar-syncs.json",
);
