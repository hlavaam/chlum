import { promises as fs } from "fs";
import path from "path";

const SEED_DATA_DIR = path.join(process.cwd(), "data");
const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? path.join("/tmp", "chlum-data") : SEED_DATA_DIR);
const writeQueues = new Map<string, Promise<unknown>>();

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function isMissingFileError(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function readJsonArrayFile<T>(filePath: string): Promise<T[] | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected array in ${path.basename(filePath)}`);
    }
    return parsed as T[];
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

function getSeedFilePath(filename: string) {
  return path.join(SEED_DATA_DIR, filename);
}

async function acquireFileLock(lockPath: string): Promise<void> {
  const retries = 60;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.close();
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error(`Lock timeout for ${lockPath}`);
}

async function releaseFileLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function enqueueWrite<R>(filePath: string, action: () => Promise<R>): Promise<R> {
  const prev = writeQueues.get(filePath) ?? Promise.resolve();
  const next = prev.then(action, action);
  writeQueues.set(filePath, next.finally(() => {
    if (writeQueues.get(filePath) === next) {
      writeQueues.delete(filePath);
    }
  }));
  return next;
}

export async function readTableFile<T>(filename: string): Promise<T[]> {
  const filePath = path.join(DATA_DIR, filename);
  const runtimeRows = await readJsonArrayFile<T>(filePath);
  if (runtimeRows) {
    return runtimeRows;
  }

  if (DATA_DIR !== SEED_DATA_DIR) {
    const seedRows = await readJsonArrayFile<T>(getSeedFilePath(filename));
    if (seedRows) {
      return seedRows;
    }
  }

  return [];
}

export async function writeTableFile<T>(filename: string, rows: T[]): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  const lockPath = `${filePath}.lock`;
  await enqueueWrite(filePath, async () => {
    await acquireFileLock(lockPath);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      const body = `${JSON.stringify(rows, null, 2)}\n`;
      await fs.writeFile(tmpPath, body, "utf8");
      await fs.rename(tmpPath, filePath);
    } finally {
      try {
        await fs.unlink(tmpPath);
      } catch {
        // noop
      }
      await releaseFileLock(lockPath);
    }
  });
}

export async function mutateTableFile<T, R>(
  filename: string,
  mutator: (rows: T[]) => Promise<{ rows: T[]; result: R }> | { rows: T[]; result: R },
): Promise<R> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  const lockPath = `${filePath}.lock`;
  return enqueueWrite(filePath, async () => {
    await acquireFileLock(lockPath);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      let currentRows = await readJsonArrayFile<T>(filePath);
      if (!currentRows && DATA_DIR !== SEED_DATA_DIR) {
        currentRows = await readJsonArrayFile<T>(getSeedFilePath(filename));
      }

      const { rows, result } = await mutator(currentRows ?? []);
      const body = `${JSON.stringify(rows, null, 2)}\n`;
      await fs.writeFile(tmpPath, body, "utf8");
      await fs.rename(tmpPath, filePath);
      return result;
    } finally {
      try {
        await fs.unlink(tmpPath);
      } catch {
        // noop
      }
      await releaseFileLock(lockPath);
    }
  });
}

export function getDataDirPath() {
  return DATA_DIR;
}
