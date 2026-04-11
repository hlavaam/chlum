import type { OpeningHoursDay, SiteSettingsRecord } from "@/types/models";

export const PUBLIC_SITE_SETTINGS_ID = "public-site-settings";

export const DEFAULT_OPENING_HOURS: OpeningHoursDay[] = [
  { key: "mon", short: "Po", label: "Pondělí", open: "11:00", close: "22:00", closed: false },
  { key: "tue", short: "Út", label: "Úterý", open: "11:00", close: "22:00", closed: false },
  { key: "wed", short: "St", label: "Středa", open: "11:00", close: "22:00", closed: false },
  { key: "thu", short: "Čt", label: "Čtvrtek", open: "11:00", close: "22:00", closed: false },
  { key: "fri", short: "Pá", label: "Pátek", open: "11:00", close: "22:00", closed: false },
  { key: "sat", short: "So", label: "Sobota", open: "11:00", close: "22:00", closed: false },
  { key: "sun", short: "Ne", label: "Neděle", open: "11:00", close: "22:00", closed: false },
];

export const DEFAULT_PUBLIC_SITE_SETTINGS = {
  siteKey: "public" as const,
  openingHours: DEFAULT_OPENING_HOURS,
};

function normalizeOpeningHoursDay(day: Partial<OpeningHoursDay> | undefined, fallback: OpeningHoursDay): OpeningHoursDay {
  return {
    key: fallback.key,
    short: fallback.short,
    label: fallback.label,
    open: day?.open?.trim() || fallback.open,
    close: day?.close?.trim() || fallback.close,
    closed: Boolean(day?.closed),
  };
}

export function normalizePublicSiteSettings(settings: Partial<SiteSettingsRecord> | null | undefined): SiteSettingsRecord {
  return {
    id: settings?.id ?? PUBLIC_SITE_SETTINGS_ID,
    createdAt: settings?.createdAt ?? "2026-04-07T00:00:00.000Z",
    updatedAt: settings?.updatedAt ?? "2026-04-07T00:00:00.000Z",
    siteKey: "public",
    openingHours: DEFAULT_OPENING_HOURS.map((fallback, index) =>
      normalizeOpeningHoursDay(settings?.openingHours?.[index], fallback),
    ),
  };
}
