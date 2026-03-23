export type StorageBackend = "d1" | "postgres" | "json";

export function getConnectionString() {
  return process.env.DATABASE_NEON_DATABASE_URL || process.env.DATABASE_URL || "";
}

export function hasDatabaseConnectionString() {
  return Boolean(getConnectionString());
}

export async function getCloudflareD1Database(): Promise<D1Database | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const context = mod.getCloudflareContext();
    return (context.env as { DB?: D1Database }).DB ?? null;
  } catch {
    return null;
  }
}

export async function getStorageBackend(): Promise<StorageBackend> {
  const d1 = await getCloudflareD1Database();
  if (d1) return "d1";
  if (hasDatabaseConnectionString()) return "postgres";
  return "json";
}
