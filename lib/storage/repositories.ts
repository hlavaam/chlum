import { JsonRepository } from "@/lib/storage/json-repository";
import { PostgresRepository } from "@/lib/storage/postgres-repository";
import { hasDatabaseUrl } from "@/lib/storage/postgres-db";
import type {
  AssignmentRecord,
  EventRecord,
  LocationRecord,
  ShiftRecord,
  UserRecord,
} from "@/types/models";

const usePostgres = hasDatabaseUrl();

export const usersRepository = usePostgres
  ? new PostgresRepository<UserRecord>("users", "users.json")
  : new JsonRepository<UserRecord>("users.json");
export const locationsRepository = usePostgres
  ? new PostgresRepository<LocationRecord>("locations", "locations.json")
  : new JsonRepository<LocationRecord>("locations.json");
export const eventsRepository = usePostgres
  ? new PostgresRepository<EventRecord>("events", "events.json")
  : new JsonRepository<EventRecord>("events.json");
export const shiftsRepository = usePostgres
  ? new PostgresRepository<ShiftRecord>("shifts", "shifts.json")
  : new JsonRepository<ShiftRecord>("shifts.json");
export const assignmentsRepository = usePostgres
  ? new PostgresRepository<AssignmentRecord>("assignments", "assignments.json")
  : new JsonRepository<AssignmentRecord>("assignments.json");
