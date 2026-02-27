const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function parseEnvFile(content) {
  const out = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = normalized.slice(0, eqIndex).trim();
    let value = normalized.slice(eqIndex + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    const hasDoubleQuotes = value.startsWith("\"") && value.endsWith("\"");
    const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
    if (hasDoubleQuotes || hasSingleQuotes) {
      value = value.slice(1, -1);
      if (hasDoubleQuotes) {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, "\"")
          .replace(/\\\\/g, "\\");
      }
    } else {
      const commentIndex = value.search(/\s#/);
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    out[key] = value;
  }
  return out;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return parseEnvFile(fs.readFileSync(filePath, "utf8"));
}

function loadEnvFromFiles() {
  const cwd = process.cwd();
  const fromDotEnv = readEnvFile(path.join(cwd, ".env"));
  const fromDotEnvLocal = readEnvFile(path.join(cwd, ".env.local"));
  const merged = { ...fromDotEnv, ...fromDotEnvLocal };
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getConnectionString() {
  return process.env.DATABASE_NEON_DATABASE_URL || process.env.DATABASE_URL;
}

function shouldUseSsl(connectionString) {
  return !/sslmode=disable/i.test(connectionString);
}

function hasExplicitSslConfigInUrl(connectionString) {
  return /(?:\?|&)sslmode=/i.test(connectionString) || /(?:\?|&)ssl=/i.test(connectionString);
}

async function main() {
  const startedAt = Date.now();
  loadEnvFromFiles();

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_NEON_DATABASE_URL or DATABASE_URL must be set");
  }

  const shouldInjectSsl = shouldUseSsl(connectionString) && !hasExplicitSslConfigInUrl(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: shouldInjectSsl ? { rejectUnauthorized: false } : undefined,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  });

  const steps = [
    [
      "create_table",
      `
        create table if not exists app_records (
          resource text not null,
          id text not null,
          payload jsonb not null,
          primary key (resource, id)
        )
      `,
    ],
    [
      "create_resource_index",
      `
        create index if not exists app_records_resource_idx
        on app_records (resource)
      `,
    ],
    [
      "create_shifts_date_index",
      `
        create index if not exists app_records_shifts_date_idx
        on app_records ((payload ->> 'date'))
        where resource = 'shifts'
      `,
    ],
    [
      "create_assignments_shift_index",
      `
        create index if not exists app_records_assignments_shift_idx
        on app_records ((payload ->> 'shiftId'))
        where resource = 'assignments'
      `,
    ],
    [
      "create_assignments_user_index",
      `
        create index if not exists app_records_assignments_user_idx
        on app_records ((payload ->> 'userId'))
        where resource = 'assignments'
      `,
    ],
    [
      "create_assignments_status_index",
      `
        create index if not exists app_records_assignments_status_idx
        on app_records ((payload ->> 'status'))
        where resource = 'assignments'
      `,
    ],
  ];

  try {
    for (const [name, sql] of steps) {
      const stepStart = Date.now();
      await pool.query(sql);
      console.log(`[db:init] step=${name} ms=${Date.now() - stepStart}`);
    }
    console.log(`[db:init] done total_ms=${Date.now() - startedAt}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db:init] failed", error);
  process.exit(1);
});
