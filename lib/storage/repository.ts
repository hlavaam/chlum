import type { BaseRecord } from "@/types/models";

export interface Repository<T extends BaseRecord> {
  loadAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(input: Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>): Promise<T>;
  update(id: string, patch: Partial<Omit<T, keyof BaseRecord>>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}
