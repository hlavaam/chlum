import { JsonRepository } from "@/lib/storage/json-repository";
import { PostgresRepository } from "@/lib/storage/postgres-repository";
import { hasDatabaseUrl, shouldFallbackToJsonStorage } from "@/lib/storage/postgres-db";
import type {
  AssignmentRecord,
  BaseRecord,
  EventRecord,
  LocationRecord,
  ShiftRecord,
  UserRecord,
} from "@/types/models";
import type { Repository } from "@/lib/storage/json-repository";

const usePostgres = hasDatabaseUrl();

class ResilientRepository<T extends BaseRecord> implements Repository<T> {
  private readonly postgres: Repository<T>;
  private readonly json: Repository<T>;
  private fallbackToJson = false;

  constructor(resource: string, filename: string) {
    this.postgres = new PostgresRepository<T>(resource, filename);
    this.json = new JsonRepository<T>(filename);
  }

  private async run<R>(operation: (repo: Repository<T>) => Promise<R>): Promise<R> {
    if (this.fallbackToJson) {
      return operation(this.json);
    }

    try {
      return await operation(this.postgres);
    } catch (error) {
      if (!shouldFallbackToJsonStorage(error)) throw error;
      this.fallbackToJson = true;
      return operation(this.json);
    }
  }

  loadAll() {
    return this.run((repo) => repo.loadAll());
  }

  findById(id: string) {
    return this.run((repo) => repo.findById(id));
  }

  create(input: Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>) {
    return this.run((repo) => repo.create(input));
  }

  update(id: string, patch: Partial<Omit<T, keyof BaseRecord>>) {
    return this.run((repo) => repo.update(id, patch));
  }

  delete(id: string) {
    return this.run((repo) => repo.delete(id));
  }
}

export const usersRepository = usePostgres
  ? new ResilientRepository<UserRecord>("users", "users.json")
  : new JsonRepository<UserRecord>("users.json");
export const locationsRepository = usePostgres
  ? new ResilientRepository<LocationRecord>("locations", "locations.json")
  : new JsonRepository<LocationRecord>("locations.json");
export const eventsRepository = usePostgres
  ? new ResilientRepository<EventRecord>("events", "events.json")
  : new JsonRepository<EventRecord>("events.json");
export const shiftsRepository = usePostgres
  ? new ResilientRepository<ShiftRecord>("shifts", "shifts.json")
  : new JsonRepository<ShiftRecord>("shifts.json");
export const assignmentsRepository = usePostgres
  ? new ResilientRepository<AssignmentRecord>("assignments", "assignments.json")
  : new JsonRepository<AssignmentRecord>("assignments.json");
