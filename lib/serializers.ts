import type { ResourceName, UserRecord } from "@/types/models";

function stripUserSecrets(user: UserRecord) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export function serializeRecord(resource: ResourceName, record: unknown) {
  if (resource === "users") {
    return stripUserSecrets(record as UserRecord);
  }
  return record;
}

export function serializeList(resource: ResourceName, rows: unknown[]) {
  return rows.map((row) => serializeRecord(resource, row));
}
