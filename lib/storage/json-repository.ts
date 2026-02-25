import { randomUUID } from "crypto";

import type { BaseRecord } from "@/types/models";
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
    return readTableFile<T>(this.filename);
  }

  async findById(id: string): Promise<T | null> {
    const rows = await this.loadAll();
    return rows.find((row) => row.id === id) ?? null;
  }

  async create(
    input: Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>,
  ): Promise<T> {
    return mutateTableFile<T, T>(this.filename, (rows) => {
      const timestamp = nowIso();
      const row: T = {
        ...input,
        id: input.id ?? randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
      } as T;
      return { rows: [...rows, row], result: row };
    });
  }

  async update(id: string, patch: Partial<Omit<T, keyof BaseRecord>>): Promise<T | null> {
    return mutateTableFile<T, T | null>(this.filename, (rows) => {
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
  }

  async delete(id: string): Promise<boolean> {
    return mutateTableFile<T, boolean>(this.filename, (rows) => {
      const next = rows.filter((row) => row.id !== id);
      return { rows: next, result: next.length !== rows.length };
    });
  }
}
