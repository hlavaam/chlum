import type { BaseRecord } from "@/types/models";
import {
  loadD1ResourceByField,
  loadD1ResourceByFieldIn,
  loadD1ResourceByFieldRange,
  loadD1ResourceByIds,
} from "@/lib/storage/d1-db";
import { getStorageBackend } from "@/lib/storage/storage-backend";

export async function loadResourceByField<T extends BaseRecord>(
  resource: string,
  field: string,
  value: string,
  fallback: () => Promise<T[]>,
): Promise<T[]> {
  const backend = await getStorageBackend();
  if (backend === "d1") {
    return loadD1ResourceByField<T>(resource, field, value);
  }
  if (backend === "postgres") {
    const { loadPostgresResourceByField } = await import("@/lib/storage/postgres-db");
    return loadPostgresResourceByField<T>(resource, field, value);
  }
  const rows = await fallback();
  return rows.filter((row) => String((row as Record<string, unknown>)[field] ?? "") === value);
}

export async function loadResourceByFieldIn<T extends BaseRecord>(
  resource: string,
  field: string,
  values: string[],
  fallback: () => Promise<T[]>,
): Promise<T[]> {
  if (values.length === 0) return [];
  const backend = await getStorageBackend();
  if (backend === "d1") {
    return loadD1ResourceByFieldIn<T>(resource, field, values);
  }
  if (backend === "postgres") {
    const { loadPostgresResourceByFieldIn } = await import("@/lib/storage/postgres-db");
    return loadPostgresResourceByFieldIn<T>(resource, field, values);
  }
  const allowed = new Set(values);
  const rows = await fallback();
  return rows.filter((row) => allowed.has(String((row as Record<string, unknown>)[field] ?? "")));
}

export async function loadResourceByIds<T extends BaseRecord>(
  resource: string,
  ids: string[],
  fallback: () => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const backend = await getStorageBackend();
  if (backend === "d1") {
    return loadD1ResourceByIds<T>(resource, ids);
  }
  if (backend === "postgres") {
    const { loadPostgresResourceByIds } = await import("@/lib/storage/postgres-db");
    return loadPostgresResourceByIds<T>(resource, ids);
  }
  const allowed = new Set(ids);
  const rows = await fallback();
  return rows.filter((row) => allowed.has(row.id));
}

export async function loadResourceByFieldRange<T extends BaseRecord>(
  resource: string,
  field: string,
  start: string,
  end: string,
  fallback: () => Promise<T[]>,
): Promise<T[]> {
  const backend = await getStorageBackend();
  if (backend === "d1") {
    return loadD1ResourceByFieldRange<T>(resource, field, start, end);
  }
  if (backend === "postgres") {
    const { loadPostgresResourceByFieldRange } = await import("@/lib/storage/postgres-db");
    return loadPostgresResourceByFieldRange<T>(resource, field, start, end);
  }
  const rows = await fallback();
  return rows.filter((row) => {
    const value = String((row as Record<string, unknown>)[field] ?? "");
    return value >= start && value <= end;
  });
}
