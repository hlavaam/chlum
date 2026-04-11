import { promises as fs } from "fs";
import path from "path";

import { getDataDirPath } from "@/lib/storage/file-db";
import type { DailyMenuDayRecord, DailyMenuStore } from "@/types/models";

const FILE_NAME = "daily-menu.json";
const writeQueues = new Map<string, Promise<unknown>>();

function getSeedFilePath() {
  return path.join(process.cwd(), "data", FILE_NAME);
}

function getRuntimeFilePath() {
  return path.join(getDataDirPath(), FILE_NAME);
}

function isMissingFileError(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function ensureDataDir() {
  await fs.mkdir(getDataDirPath(), { recursive: true });
}

async function readStoreFile(filePath: string): Promise<DailyMenuStore | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as Partial<DailyMenuStore>;
    if (!parsed || typeof parsed !== "object" || !parsed.days || typeof parsed.days !== "object") {
      return { days: {} };
    }
    return { days: { ...(parsed.days as DailyMenuStore["days"]) } };
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    return { days: {} };
  }
}

async function readStore(): Promise<DailyMenuStore> {
  const runtimeStore = await readStoreFile(getRuntimeFilePath());
  if (runtimeStore) {
    return runtimeStore;
  }
  const seedPath = getSeedFilePath();
  if (seedPath !== getRuntimeFilePath()) {
    const seedStore = await readStoreFile(seedPath);
    if (seedStore) {
      return seedStore;
    }
  }
  return { days: {} };
}

async function enqueueWrite<R>(filePath: string, action: () => Promise<R>): Promise<R> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const next = previous.then(action, action);
  writeQueues.set(
    filePath,
    next.finally(() => {
      if (writeQueues.get(filePath) === next) {
        writeQueues.delete(filePath);
      }
    }),
  );
  return next;
}

async function writeStore(store: DailyMenuStore): Promise<void> {
  const filePath = getRuntimeFilePath();
  await ensureDataDir();
  await enqueueWrite(filePath, async () => {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      await fs.rename(tempPath, filePath);
    } finally {
      try {
        await fs.unlink(tempPath);
      } catch {
        // noop
      }
    }
  });
}

export const dailyMenuFileStore = {
  async getMenu(date: string): Promise<DailyMenuDayRecord | null> {
    const store = await readStore();
    return store.days[date] ?? null;
  },

  async listDates(): Promise<Array<{ date: string; title: string; updatedAt: string | null; isPublished: boolean }>> {
    const store = await readStore();
    return Object.entries(store.days)
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, menu]) => ({
        date,
        title: menu.title || "Denní menu",
        updatedAt: menu.updatedAt || null,
        isPublished: menu.isPublished === true,
      }));
  },

  async getPublishedMenu(): Promise<{ date: string; menu: DailyMenuDayRecord } | null> {
    const store = await readStore();
    const publishedEntry = Object.entries(store.days)
      .sort(([left], [right]) => right.localeCompare(left))
      .find(([, menu]) => menu.isPublished === true);

    if (!publishedEntry) {
      return null;
    }

    const [date, menu] = publishedEntry;
    return { date, menu };
  },

  async saveMenu(date: string, menu: DailyMenuDayRecord): Promise<DailyMenuDayRecord> {
    const store = await readStore();
    if (menu.isPublished) {
      Object.keys(store.days).forEach((key) => {
        if (store.days[key]) {
          store.days[key].isPublished = false;
        }
      });
    }
    store.days[date] = menu;
    await writeStore(store);
    return menu;
  },

  async deleteMenu(date: string): Promise<void> {
    const store = await readStore();
    if (!store.days[date]) return;
    delete store.days[date];
    await writeStore(store);
  },
};
