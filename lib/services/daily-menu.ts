import { AdaptiveRepository } from "@/lib/storage/repositories";
import { getStorageBackend } from "@/lib/storage/storage-backend";
import type { DailyMenuDayRecord, DailyMenuItem, DailyMenuRecord } from "@/types/models";

const dailyMenuRepository = new AdaptiveRepository<DailyMenuRecord>("daily_menu", "daily-menu.records.json");

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeItems(items: unknown): DailyMenuItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 40)
    .map((item) => ({
      category: cleanText((item as DailyMenuItem).category, 60),
      name: cleanText((item as DailyMenuItem).name, 160),
      price: cleanText((item as DailyMenuItem).price, 50),
      allergens: cleanText((item as DailyMenuItem).allergens, 80),
    }))
    .filter((item) => item.name);
}

function toDayRecord(record: DailyMenuRecord): DailyMenuDayRecord {
  return {
    title: record.title,
    note: record.note,
    items: record.items,
    updatedAt: record.updatedAt,
  };
}

async function getFileStore() {
  const mod = await import("@/lib/services/daily-menu-file-store");
  return mod.dailyMenuFileStore;
}

async function loadDatabaseMenuRecord(date: string): Promise<DailyMenuRecord | null> {
  const rows = await dailyMenuRepository.loadAll();
  return rows.find((row) => row.date === date) ?? null;
}

async function listDatabaseMenuRecords(): Promise<DailyMenuRecord[]> {
  const rows = await dailyMenuRepository.loadAll();
  return rows.sort((left, right) => right.date.localeCompare(left.date));
}

export function isValidMenuDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function toMenuDateKey(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function normalizeDailyMenuPayload(payload: unknown) {
  const source = payload && typeof payload === "object" ? payload as Partial<DailyMenuDayRecord> : {};
  const title = cleanText(source.title, 120) || "Denní menu";
  const note = cleanText(source.note, 500);
  const items = normalizeItems(source.items);
  return { title, note, items };
}

export const dailyMenuService = {
  async getMenu(date: string): Promise<DailyMenuDayRecord | null> {
    if (!isValidMenuDate(date)) return null;
    const backend = await getStorageBackend();
    if (backend === "json") {
      return (await getFileStore()).getMenu(date);
    }
    const record = await loadDatabaseMenuRecord(date);
    return record ? toDayRecord(record) : null;
  },

  async listDates(): Promise<Array<{ date: string; title: string; updatedAt: string | null }>> {
    const backend = await getStorageBackend();
    if (backend === "json") {
      return (await getFileStore()).listDates();
    }
    const rows = await listDatabaseMenuRecords();
    return rows.map((menu) => ({
      date: menu.date,
      title: menu.title || "Denní menu",
      updatedAt: menu.updatedAt || null,
    }));
  },

  async saveMenu(date: string, payload: unknown): Promise<DailyMenuDayRecord> {
    if (!isValidMenuDate(date)) {
      throw new Error("Neplatne datum. Pouzijte format YYYY-MM-DD.");
    }
    const normalized = normalizeDailyMenuPayload(payload);
    if (normalized.items.length === 0) {
      throw new Error("Menu musi obsahovat alespon jednu polozku.");
    }

    const nextMenu: DailyMenuDayRecord = {
      ...normalized,
      updatedAt: new Date().toISOString(),
    };

    const backend = await getStorageBackend();
    if (backend === "json") {
      return (await getFileStore()).saveMenu(date, nextMenu);
    }

    const existing = await loadDatabaseMenuRecord(date);
    if (existing) {
      await dailyMenuRepository.update(existing.id, {
        date,
        ...nextMenu,
      });
      return nextMenu;
    }

    await dailyMenuRepository.create({
      date,
      ...nextMenu,
    });
    return nextMenu;
  },

  async deleteMenu(date: string): Promise<void> {
    if (!isValidMenuDate(date)) {
      throw new Error("Neplatne datum. Pouzijte format YYYY-MM-DD.");
    }

    const backend = await getStorageBackend();
    if (backend === "json") {
      await (await getFileStore()).deleteMenu(date);
      return;
    }

    const existing = await loadDatabaseMenuRecord(date);
    if (!existing) return;
    await dailyMenuRepository.delete(existing.id);
  },
};
