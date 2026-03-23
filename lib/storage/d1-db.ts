import type { BaseRecord } from "@/types/models";
import { startPerfTrace } from "@/lib/perf";
import { getCloudflareD1Database } from "@/lib/storage/storage-backend";

type PayloadRow<T extends BaseRecord> = {
  payload: string | T;
};

function parsePayload<T extends BaseRecord>(value: string | T): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

async function requireD1Database() {
  const db = await getCloudflareD1Database();
  if (!db) {
    throw new Error("Cloudflare D1 binding DB is not available");
  }
  return db;
}

async function runAll<T extends BaseRecord>(sql: string, values: unknown[]): Promise<T[]> {
  const trace = startPerfTrace("d1.query", {
    sql: sql.replace(/\s+/g, " ").trim().slice(0, 160),
    params: values.length,
  });
  try {
    const db = await requireD1Database();
    const result = await db.prepare(sql).bind(...values).run<PayloadRow<T>>();
    const rows = (result.results ?? []).map((row) => parsePayload<T>(row.payload));
    trace.end({ rows: rows.length });
    return rows;
  } catch (error) {
    trace.fail(error);
    throw error;
  }
}

export async function listD1Resource<T extends BaseRecord>(resource: string): Promise<T[]> {
  return runAll<T>(
    "select payload from app_records where resource = ?",
    [resource],
  );
}

export async function findD1ResourceById<T extends BaseRecord>(
  resource: string,
  id: string,
): Promise<T | null> {
  const rows = await runAll<T>(
    "select payload from app_records where resource = ? and id = ? limit 1",
    [resource, id],
  );
  return rows[0] ?? null;
}

export async function upsertD1Resource<T extends BaseRecord>(resource: string, row: T): Promise<T> {
  const trace = startPerfTrace("d1.upsert", { resource, id: row.id });
  try {
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
  const rows = await listD1Resource<T>(resource);
  return rows.filter((row) => readField(row, field) === value);
}

export async function loadD1ResourceByFieldIn<T extends BaseRecord>(
  resource: string,
  field: string,
  values: string[],
): Promise<T[]> {
  if (values.length === 0) return [];
  const allowed = new Set(values);
  const rows = await listD1Resource<T>(resource);
  return rows.filter((row) => allowed.has(readField(row, field)));
}

export async function loadD1ResourceByIds<T extends BaseRecord>(
  resource: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const allowed = new Set(ids);
  const rows = await listD1Resource<T>(resource);
  return rows.filter((row) => allowed.has(row.id));
}

export async function loadD1ResourceByFieldRange<T extends BaseRecord>(
  resource: string,
  field: string,
  start: string,
  end: string,
): Promise<T[]> {
  const rows = await listD1Resource<T>(resource);
  return rows.filter((row) => {
    const value = readField(row, field);
    return value >= start && value <= end;
  });
}
