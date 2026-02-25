export function nowIso(): string {
  return new Date().toISOString();
}

export function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function formatCzDate(dateKey: string): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseDateKey(dateKey));
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime}–${endTime}`;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getMonthGrid(date: Date): string[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    out.push(toDateKey(d));
  }
  return out;
}

export function getWeekDays(date: Date): string[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, idx) => toDateKey(addDays(start, idx)));
}

export function coerceBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["1", "true", "on", "yes"].includes(normalized)) return true;
    if (["0", "false", "off", "no"].includes(normalized)) return false;
  }
  return fallback;
}

export function csvEscape(value: unknown): string {
  const raw = String(value ?? "");
  if (/[",\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

export function safeInt(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
