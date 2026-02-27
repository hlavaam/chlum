import { randomUUID } from "crypto";

import type { BaseRecord } from "@/types/models";
import { startPerfTrace } from "@/lib/perf";
import { nowIso } from "@/lib/utils";
import { mutateTableFile, readTableFile } from "@/lib/storage/file-db";

export interface Repository<T extends BaseRecord> {
  loadAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(input: Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>): Promise<T>;
  update(id: string, patch: Partial<Omit<T, keyof BaseRecord>>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export class JsonRepository<T extends BaseRecord> implements Repository<T> {
  constructor(private readonly filename: string) {}

  async loadAll(): Promise<T[]> {
    const trace = startPerfTrace("json.load_all", { file: this.filename });
    try {
      const rows = await readTableFile<T>(this.filename);
      trace.end({ rows: rows.length });
      return rows;
    } catch (error) {
      trace.fail(error);
      throw error;
    }
  }

  async findById(id: string): Promise<T | null> {
    const trace = startPerfTrace("json.find_by_id", { file: this.filename, id });
    const rows = await this.loadAll();
    const result = rows.find((row) => row.id === id) ?? null;
    trace.end({ found: Boolean(result) });
    return result;
  }

  async create(
    input: Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>,
  ): Promise<T> {
    const trace = startPerfTrace("json.create", { file: this.filename });
    const result = await mutateTableFile<T, T>(this.filename, (rows) => {
      const timestamp = nowIso();
      const row: T = {
        ...input,
        id: input.id ?? randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
      } as T;
      return { rows: [...rows, row], result: row };
    });
    trace.end({ id: result.id });
    return result;
  }

  async update(id: string, patch: Partial<Omit<T, keyof BaseRecord>>): Promise<T | null> {
    const trace = startPerfTrace("json.update", { file: this.filename, id });
    const result = await mutateTableFile<T, T | null>(this.filename, (rows) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return { rows, result: null };
      const current = rows[index];
      const next: T = {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: nowIso(),
      };
      const nextRows = [...rows];
      nextRows[index] = next;
      return { rows: nextRows, result: next };
    });
    trace.end({ found: Boolean(result) });
    return result;
  }

  async delete(id: string): Promise<boolean> {
    const trace = startPerfTrace("json.delete", { file: this.filename, id });
    const result = await mutateTableFile<T, boolean>(this.filename, (rows) => {
      const next = rows.filter((row) => row.id !== id);
      return { rows: next, result: next.length !== rows.length };
    });
    trace.end({ deleted: result });
    return result;
  }
}
