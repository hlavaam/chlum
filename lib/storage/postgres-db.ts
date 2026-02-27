import { Pool } from "pg";
import type { BaseRecord } from "@/types/models";
import { startPerfTrace } from "@/lib/perf";

type QueryRow<T extends BaseRecord> = {
  payload: T;
};

let poolPromise: Promise<any> | null = null;

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

export function hasDatabaseUrl() {
  return Boolean(getConnectionString());
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
  const pool = await getPostgresPool();
  const result = await pool.query(
    `select payload from app_records where resource = $1 and payload ->> '${field}' = $2`,
    [resource, value],
  );
  return (result.rows as QueryRow<T>[]).map((row) => row.payload);
}

export async function loadPostgresResourceByFieldIn<T extends BaseRecord>(
  resource: string,
  field: string,
  values: string[],
): Promise<T[]> {
  assertSafeJsonField(field);
  if (values.length === 0) return [];
  const pool = await getPostgresPool();
  const result = await pool.query(
    `select payload from app_records where resource = $1 and payload ->> '${field}' = any($2::text[])`,
    [resource, values],
  );
  return (result.rows as QueryRow<T>[]).map((row) => row.payload);
}

export async function loadPostgresResourceByIds<T extends BaseRecord>(
  resource: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const pool = await getPostgresPool();
  const result = await pool.query(
    "select payload from app_records where resource = $1 and id = any($2::text[])",
    [resource, ids],
  );
  return (result.rows as QueryRow<T>[]).map((row) => row.payload);
}

export async function loadPostgresResourceByFieldRange<T extends BaseRecord>(
  resource: string,
  field: string,
  start: string,
  end: string,
): Promise<T[]> {
  assertSafeJsonField(field);
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
}

export async function countPostgresResourceByField(
  resource: string,
  field: string,
  value: string,
): Promise<number> {
  assertSafeJsonField(field);
  const pool = await getPostgresPool();
  const result = await pool.query(
    `select count(*)::int as count from app_records where resource = $1 and payload ->> '${field}' = $2`,
    [resource, value],
  );
  return Number(result.rows[0]?.count ?? 0);
}
