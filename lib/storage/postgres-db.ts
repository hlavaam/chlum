import { Pool } from "pg";
import type { BaseRecord } from "@/types/models";
import { startPerfTrace } from "@/lib/perf";
import { readTableFile } from "@/lib/storage/file-db";

type QueryRow<T extends BaseRecord> = {
  payload: T;
};

let poolPromise: Promise<any> | null = null;
let postgresDisabled = false;

function getConnectionString() {
  return process.env.DATABASE_NEON_DATABASE_URL || process.env.DATABASE_URL;
}

function shouldUseSsl(connectionString: string) {
  return !/sslmode=disable/i.test(connectionString);
}

function hasExplicitSslConfigInUrl(connectionString: string) {
  return /(?:\?|&)sslmode=/i.test(connectionString) || /(?:\?|&)ssl=/i.test(connectionString);
}

async function createPool() {
  const trace = startPerfTrace("postgres.create_pool");
  const connectionString = getConnectionString();
  if (!connectionString) {
    trace.end({ result: "missing_connection_string" });
    throw new Error("DATABASE_NEON_DATABASE_URL or DATABASE_URL must be set");
  }

  const shouldInjectSsl = shouldUseSsl(connectionString) && !hasExplicitSslConfigInUrl(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: shouldInjectSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 5_000),
    keepAlive: true,
  });
  trace.end({
    ssl_injected: shouldInjectSsl,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idle_timeout_ms: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    connection_timeout_ms: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 5_000),
  });
  return pool;
}

function assertSafeJsonField(field: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new Error(`Unsafe JSON field: ${field}`);
  }
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function shouldFallbackToJsonStorage(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  if ([
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "28P01",
    "3D000",
    "08001",
    "08006",
    "57P01",
    "57P03",
    "XX000",
  ].includes(code)) {
    return true;
  }
  return /tenant or user not found|password authentication failed|database .* does not exist|connect|connection/i.test(message);
}

function disablePostgres() {
  postgresDisabled = true;
  poolPromise = null;
}

async function readJsonResource<T extends BaseRecord>(resource: string) {
  return readTableFile<T>(`${resource}.json`);
}

export function hasDatabaseUrl() {
  return Boolean(getConnectionString()) && !postgresDisabled;
}

export async function getPostgresPool() {
  if (!poolPromise) {
    poolPromise = createPool();
  }
  return poolPromise;
}

export async function loadPostgresResourceByField<T extends BaseRecord>(
  resource: string,
  field: string,
  value: string,
): Promise<T[]> {
  assertSafeJsonField(field);
  try {
    const pool = await getPostgresPool();
    const result = await pool.query(
      `select payload from app_records where resource = $1 and payload ->> '${field}' = $2`,
      [resource, value],
    );
    return (result.rows as QueryRow<T>[]).map((row) => row.payload);
  } catch (error) {
    if (!shouldFallbackToJsonStorage(error)) throw error;
    disablePostgres();
    const rows = await readJsonResource<T>(resource);
    return rows.filter((row) => String((row as Record<string, unknown>)[field] ?? "") === value);
  }
}

export async function loadPostgresResourceByFieldIn<T extends BaseRecord>(
  resource: string,
  field: string,
  values: string[],
): Promise<T[]> {
  assertSafeJsonField(field);
  if (values.length === 0) return [];
  try {
    const pool = await getPostgresPool();
    const result = await pool.query(
      `select payload from app_records where resource = $1 and payload ->> '${field}' = any($2::text[])`,
      [resource, values],
    );
    return (result.rows as QueryRow<T>[]).map((row) => row.payload);
  } catch (error) {
    if (!shouldFallbackToJsonStorage(error)) throw error;
    disablePostgres();
    const allowed = new Set(values);
    const rows = await readJsonResource<T>(resource);
    return rows.filter((row) => allowed.has(String((row as Record<string, unknown>)[field] ?? "")));
  }
}

export async function loadPostgresResourceByIds<T extends BaseRecord>(
  resource: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  try {
    const pool = await getPostgresPool();
    const result = await pool.query(
      "select payload from app_records where resource = $1 and id = any($2::text[])",
      [resource, ids],
    );
    return (result.rows as QueryRow<T>[]).map((row) => row.payload);
  } catch (error) {
    if (!shouldFallbackToJsonStorage(error)) throw error;
    disablePostgres();
    const allowed = new Set(ids);
    const rows = await readJsonResource<T>(resource);
    return rows.filter((row) => allowed.has(row.id));
  }
}

export async function loadPostgresResourceByFieldRange<T extends BaseRecord>(
  resource: string,
  field: string,
  start: string,
  end: string,
): Promise<T[]> {
  assertSafeJsonField(field);
  try {
    const pool = await getPostgresPool();
    const result = await pool.query(
      `
        select payload
        from app_records
        where resource = $1
        and payload ->> '${field}' >= $2
        and payload ->> '${field}' <= $3
      `,
      [resource, start, end],
    );
    return (result.rows as QueryRow<T>[]).map((row) => row.payload);
  } catch (error) {
    if (!shouldFallbackToJsonStorage(error)) throw error;
    disablePostgres();
    const rows = await readJsonResource<T>(resource);
    return rows.filter((row) => {
      const fieldValue = String((row as Record<string, unknown>)[field] ?? "");
      return fieldValue >= start && fieldValue <= end;
    });
  }
}

export async function countPostgresResourceByField(
  resource: string,
  field: string,
  value: string,
): Promise<number> {
  assertSafeJsonField(field);
  try {
    const pool = await getPostgresPool();
    const result = await pool.query(
      `select count(*)::int as count from app_records where resource = $1 and payload ->> '${field}' = $2`,
      [resource, value],
    );
    return Number(result.rows[0]?.count ?? 0);
  } catch (error) {
    if (!shouldFallbackToJsonStorage(error)) throw error;
    disablePostgres();
    const rows = await readJsonResource<BaseRecord>(resource);
    return rows.filter((row) => String((row as unknown as Record<string, unknown>)[field] ?? "") === value).length;
  }
}
