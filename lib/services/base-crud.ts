import type { BaseRecord } from "@/types/models";
import type { Repository } from "@/lib/storage/json-repository";

export interface CrudService<T extends BaseRecord> {
  loadAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(input: Partial<T>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export class BaseCrudService<T extends BaseRecord> implements CrudService<T> {
  constructor(protected readonly repo: Repository<T>) {}

  loadAll(): Promise<T[]> {
    return this.repo.loadAll();
  }

  findById(id: string): Promise<T | null> {
    return this.repo.findById(id);
  }

  async create(input: Partial<T>): Promise<T> {
    return this.repo.create(input as never);
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...safePatch } = patch;
    return this.repo.update(id, safePatch as never);
  }

  delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}
