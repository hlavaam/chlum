import { Pool } from "pg";

let poolPromise: Promise<any> | null = null;
let schemaPromise: Promise<void> | null = null;

function shouldUseSsl(connectionString: string) {
  return !/sslmode=disable/i.test(connectionString);
}

function hasExplicitSslConfigInUrl(connectionString: string) {
  return /(?:\?|&)sslmode=/i.test(connectionString) || /(?:\?|&)ssl=/i.test(connectionString);
}

async function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const shouldInjectSsl = shouldUseSsl(connectionString) && !hasExplicitSslConfigInUrl(connectionString);
  return new Pool({
    connectionString,
    ssl: shouldInjectSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getPostgresPool() {
  if (!poolPromise) {
    poolPromise = createPool();
  }
  return poolPromise;
}

export async function ensurePostgresStorageSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = await getPostgresPool();
      await pool.query(`
        create table if not exists app_records (
          resource text not null,
          id text not null,
          payload jsonb not null,
          primary key (resource, id)
        )
      `);
      await pool.query(`
        create index if not exists app_records_resource_idx
        on app_records (resource)
      `);
    })();
  }
  return schemaPromise;
}
