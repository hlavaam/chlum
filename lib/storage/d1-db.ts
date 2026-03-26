import { readTableFile } from "@/lib/storage/file-db";
import { startPerfTrace } from "@/lib/perf";
import { getCloudflareD1Database } from "@/lib/storage/storage-backend";
import type { BaseRecord, ResourceName } from "@/types/models";

type PayloadRow<T extends BaseRecord> = {
  payload: string | T;
};

type CountRow = {
  count: number | string;
};

const RESOURCE_SEED_FILES: Record<ResourceName, string> = {
  users: "users.json",
  locations: "locations.json",
  events: "events.json",
  shifts: "shifts.json",
  shift_presets: "shift-presets.json",
  assignments: "assignments.json",
  invites: "invites.json",
  calendar_connections: "calendar-connections.json",
  calendar_syncs: "calendar-syncs.json",
  base_attendance: "base-attendance.json",
};

let schemaReadyPromise: Promise<void> | null = null;
const seededResources = new Map<string, Promise<void>>();

function parsePayload<T extends BaseRecord>(value: string | T): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

function assertSafeJsonField(field: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new Error(`Unsafe JSON field: ${field}`);
  }
}

function getJsonFieldExpression(field: string) {
  assertSafeJsonField(field);
  return `json_extract(payload, '$.${field}')`;
}

async function requireD1Database() {
  const db = await getCloudflareD1Database();
  if (!db) {
    throw new Error("Cloudflare D1 binding DB is not available");
  }
  return db;
}

async function ensureD1Schema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const trace = startPerfTrace("d1.ensure_schema");
      try {
        const db = await requireD1Database();
        await db.prepare(
          `
            create table if not exists app_records (
              resource text not null,
              id text not null,
              payload text not null,
              primary key (resource, id)
            )
          `,
        ).run();
        await db.prepare(
          "create index if not exists app_records_resource_idx on app_records (resource)",
        ).run();
        trace.end();
      } catch (error) {
        schemaReadyPromise = null;
        trace.fail(error);
        throw error;
      }
    })();
  }
  return schemaReadyPromise;
}

async function runQuery<T>(sql: string, values: unknown[]): Promise<T[]> {
  await ensureD1Schema();
  const db = await requireD1Database();
  const result = await db.prepare(sql).bind(...values).run<T>();
  return result.results ?? [];
}

async function seedD1ResourceIfEmpty(resource: string) {
  const seedFile = RESOURCE_SEED_FILES[resource as ResourceName];
  if (!seedFile) return;
  if (!seededResources.has(resource)) {
    seededResources.set(resource, (async () => {
      const trace = startPerfTrace("d1.seed", { resource, seed_file: seedFile });
      try {
        const rows = await runQuery<CountRow>(
          "select count(*) as count from app_records where resource = ?",
          [resource],
        );
        const count = Number(rows[0]?.count ?? 0);
        trace.step("count_existing", { count });
        if (count > 0) {
          trace.end({ status: "skipped_non_empty" });
          return;
        }

        const seedRows = await readTableFile<BaseRecord>(seedFile);
        trace.step("load_seed_file", { rows: seedRows.length });
        if (seedRows.length === 0) {
          trace.end({ status: "skipped_empty_file" });
          return;
        }

        const db = await requireD1Database();
        for (const row of seedRows) {
          await db.prepare(
            `
              insert into app_records (resource, id, payload)
              values (?, ?, ?)
              on conflict(resource, id) do nothing
            `,
          ).bind(resource, row.id, JSON.stringify(row)).run();
        }
        trace.end({ status: "seeded", rows: seedRows.length });
      } catch (error) {
        seededResources.delete(resource);
        trace.fail(error);
        throw error;
      }
    })());
  }
  return seededResources.get(resource);
}

async function runAll<T extends BaseRecord>(sql: string, values: unknown[]): Promise<T[]> {
  const trace = startPerfTrace("d1.query", {
    sql: sql.replace(/\s+/g, " ").trim().slice(0, 160),
    params: values.length,
  });
  try {
    const result = await runQuery<PayloadRow<T>>(sql, values);
    const rows = result.map((row) => parsePayload<T>(row.payload));
    trace.end({ rows: rows.length });
    return rows;
  } catch (error) {
    trace.fail(error);
    throw error;
  }
}

export async function listD1Resource<T extends BaseRecord>(resource: string): Promise<T[]> {
  await seedD1ResourceIfEmpty(resource);
  return runAll<T>(
    "select payload from app_records where resource = ?",
    [resource],
  );
}

export async function findD1ResourceById<T extends BaseRecord>(
  resource: string,
  id: string,
): Promise<T | null> {
  await seedD1ResourceIfEmpty(resource);
  const rows = await runAll<T>(
    "select payload from app_records where resource = ? and id = ? limit 1",
    [resource, id],
  );
  return rows[0] ?? null;
}

export async function upsertD1Resource<T extends BaseRecord>(resource: string, row: T): Promise<T> {
  const trace = startPerfTrace("d1.upsert", { resource, id: row.id });
  try {
    await ensureD1Schema();
    const db = await requireD1Database();
    await db.prepare(
      `
        insert into app_records (resource, id, payload)
        values (?, ?, ?)
        on conflict(resource, id) do update set payload = excluded.payload
      `,
    ).bind(resource, row.id, JSON.stringify(row)).run();
    trace.end();
    return row;
  } catch (error) {
    trace.fail(error);
    throw error;
  }
}

export async function deleteD1Resource(resource: string, id: string): Promise<boolean> {
  const trace = startPerfTrace("d1.delete", { resource, id });
  try {
    await ensureD1Schema();
    const db = await requireD1Database();
    const result = await db.prepare(
      "delete from app_records where resource = ? and id = ?",
    ).bind(resource, id).run();
    const deleted = Number(result.meta?.changes ?? 0) > 0;
    trace.end({ deleted });
    return deleted;
  } catch (error) {
    trace.fail(error);
    throw error;
  }
}

function readField(row: BaseRecord, field: string) {
  return String((row as unknown as Record<string, unknown>)[field] ?? "");
}

export async function loadD1ResourceByField<T extends BaseRecord>(
  resource: string,
  field: string,
  value: string,
): Promise<T[]> {
  await seedD1ResourceIfEmpty(resource);
  return runAll<T>(
    `select payload from app_records where resource = ? and ${getJsonFieldExpression(field)} = ?`,
    [resource, value],
  );
}

export async function loadD1ResourceByFieldIn<T extends BaseRecord>(
  resource: string,
  field: string,
  values: string[],
): Promise<T[]> {
  if (values.length === 0) return [];
  await seedD1ResourceIfEmpty(resource);
  const placeholders = values.map(() => "?").join(", ");
  return runAll<T>(
    `select payload from app_records where resource = ? and ${getJsonFieldExpression(field)} in (${placeholders})`,
    [resource, ...values],
  );
}

export async function loadD1ResourceByIds<T extends BaseRecord>(
  resource: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  await seedD1ResourceIfEmpty(resource);
  const placeholders = ids.map(() => "?").join(", ");
  return runAll<T>(
    `select payload from app_records where resource = ? and id in (${placeholders})`,
    [resource, ...ids],
  );
}

export async function loadD1ResourceByFieldRange<T extends BaseRecord>(
  resource: string,
  field: string,
  start: string,
  end: string,
): Promise<T[]> {
  await seedD1ResourceIfEmpty(resource);
  const fieldExpr = getJsonFieldExpression(field);
  return runAll<T>(
    `select payload from app_records where resource = ? and ${fieldExpr} >= ? and ${fieldExpr} <= ?`,
    [resource, start, end],
  );
}

export async function countD1ResourceByField(
  resource: string,
  field: string,
  value: string,
): Promise<number> {
  await seedD1ResourceIfEmpty(resource);
  const rows = await runQuery<CountRow>(
    `select count(*) as count from app_records where resource = ? and ${getJsonFieldExpression(field)} = ?`,
    [resource, value],
  );
  return Number(rows[0]?.count ?? 0);
}
