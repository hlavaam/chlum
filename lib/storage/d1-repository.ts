import { randomUUID } from "crypto";

import type { BaseRecord } from "@/types/models";
import { nowIso } from "@/lib/utils";
import type { Repository } from "@/lib/storage/repository";
import {
  deleteD1Resource,
  findD1ResourceById,
  listD1Resource,
  upsertD1Resource,
} from "@/lib/storage/d1-db";

export class D1Repository<T extends BaseRecord> implements Repository<T> {
  constructor(private readonly resource: string) {}

  loadAll(): Promise<T[]> {
    return listD1Resource<T>(this.resource);
  }

  findById(id: string): Promise<T | null> {
    return findD1ResourceById<T>(this.resource, id);
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
    return upsertD1Resource(this.resource, row);
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
    return upsertD1Resource(this.resource, next);
  }

  delete(id: string): Promise<boolean> {
    return deleteD1Resource(this.resource, id);
  }
}
