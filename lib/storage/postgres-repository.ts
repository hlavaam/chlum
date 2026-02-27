import { randomUUID } from "crypto";

import type { BaseRecord } from "@/types/models";
import { startPerfTrace } from "@/lib/perf";
import { nowIso } from "@/lib/utils";
import type { Repository } from "@/lib/storage/json-repository";
import { readTableFile } from "@/lib/storage/file-db";
import { ensurePostgresStorageSchema, getPostgresPool } from "@/lib/storage/postgres-db";

type QueryRow<T extends BaseRecord> = {
  payload: T;
};

export class PostgresRepository<T extends BaseRecord> implements Repository<T> {
  private seeded = false;

  constructor(
    private readonly resource: string,
    private readonly seedFilename?: string,
  ) {}

  private summarizeSql(sql: string) {
    return sql.replace(/\s+/g, " ").trim().slice(0, 160);
  }

  private async query(sql: string, values: unknown[] = []) {
    const trace = startPerfTrace("postgres.query", {
      resource: this.resource,
      sql: this.summarizeSql(sql),
      params: values.length,
    });
    try {
      await ensurePostgresStorageSchema();
      trace.step("ensure_schema");
      const pool = await getPostgresPool();
      trace.step("get_pool");
      const result = await pool.query(sql, values);
      trace.step("execute", { row_count: Number(result.rowCount ?? 0) });
      trace.end();
      return result;
    } catch (error) {
      trace.fail(error);
      throw error;
    }
  }

  private async seedFromJsonIfEmpty() {
    if (this.seeded || !this.seedFilename) return;
    const trace = startPerfTrace("postgres.seed", {
      resource: this.resource,
      seed_file: this.seedFilename,
    });

    const countResult = await this.query(
      "select count(*)::int as count from app_records where resource = $1",
      [this.resource],
    );
    const count = Number(countResult.rows[0]?.count ?? 0);
    trace.step("count_existing", { count });
    if (count > 0) {
      this.seeded = true;
      trace.end({ status: "skipped_non_empty" });
      return;
    }

    const rows = await readTableFile<T>(this.seedFilename);
    trace.step("load_seed_file", { rows: rows.length });
    if (rows.length === 0) {
      this.seeded = true;
      trace.end({ status: "skipped_empty_file" });
      return;
    }

    for (const row of rows) {
      await this.query(
        `
          insert into app_records (resource, id, payload)
          values ($1, $2, $3::jsonb)
          on conflict (resource, id) do nothing
        `,
        [this.resource, row.id, JSON.stringify(row)],
      );
    }
    this.seeded = true;
    trace.end({ status: "seeded", rows: rows.length });
  }

  async loadAll(): Promise<T[]> {
    await this.seedFromJsonIfEmpty();
    const result = await this.query(
      "select payload from app_records where resource = $1",
      [this.resource],
    );
    return (result.rows as QueryRow<T>[]).map((row) => row.payload);
  }

  async findById(id: string): Promise<T | null> {
    await this.seedFromJsonIfEmpty();
    const result = await this.query(
      "select payload from app_records where resource = $1 and id = $2 limit 1",
      [this.resource, id],
    );
    return ((result.rows[0] as QueryRow<T> | undefined)?.payload) ?? null;
  }

  async create(
    input: Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>,
  ): Promise<T> {
    const timestamp = nowIso();
    const row: T = {
      ...input,
      id: input.id ?? randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    } as T;
    await this.query(
      `
        insert into app_records (resource, id, payload)
        values ($1, $2, $3::jsonb)
      `,
      [this.resource, row.id, JSON.stringify(row)],
    );
    return row;
  }

  async update(id: string, patch: Partial<Omit<T, keyof BaseRecord>>): Promise<T | null> {
    const current = await this.findById(id);
    if (!current) return null;
    const next: T = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    };
    await this.query(
      `
        update app_records
        set payload = $3::jsonb
        where resource = $1 and id = $2
      `,
      [this.resource, id, JSON.stringify(next)],
    );
    return next;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.query(
      "delete from app_records where resource = $1 and id = $2",
      [this.resource, id],
    );
    return Number(result.rowCount ?? 0) > 0;
  }
}
