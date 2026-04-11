import { revalidatePath } from "next/cache";

import { usersService } from "@/lib/services/users";
import { locationsService } from "@/lib/services/locations";
import { filterBaseLocations } from "@/lib/services/base-locations";
import {
  createBaseReservationForActor,
  deleteBaseReservationForActor,
  getAllowedBaseLocationIdsForActor,
  type BaseReservationInput,
} from "@/lib/services/base-reservation-intake";
import { baseReservationsService } from "@/lib/services/base-reservations";
import { telegramReservationSessionsService } from "@/lib/services/telegram-reservation-sessions";
import { workPaths } from "@/lib/paths";
import { addDays, formatCzDate, toDateKey } from "@/lib/utils";
import type { TelegramReservationSessionRecord } from "@/types/models";

type TelegramChat = {
  id: number;
  type: string;
};

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

type TelegramConfig = {
  token: string;
  webhookSecret: string;
  chatUserMap: Map<string, string>;
  defaultLocationMap: Map<string, string>;
  siteUrl: string;
};

type ParsedReservation = BaseReservationInput;

type BotReply = {
  text: string;
};

const TELEGRAM_MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "rez" }, { text: "smaz" }],
    [{ text: "/form" }, { text: "/pobocky" }],
    [{ text: "/help" }, { text: "/cancel" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

type MonthName = keyof typeof CZECH_MONTHS;

const CZECH_MONTHS = {
  ledna: 1,
  unor: 2,
  unora: 2,
  brezna: 3,
  dubna: 4,
  kvetna: 5,
  cervna: 6,
  cervence: 7,
  srpna: 8,
  zari: 9,
  rijna: 10,
  listopadu: 11,
  prosince: 12,
} as const;

const FILLER_WORDS = new Set([
  "rez",
  "rezervace",
  "rezervaci",
  "rezervaci.",
  "mame",
  "pro",
  "na",
  "v",
  "ve",
  "dnes",
  "zitra",
  "pozitri",
  "sobota",
  "sobotu",
  "nedele",
  "nedeli",
  "pondeli",
  "utery",
  "streda",
  "ctvrtek",
  "patek",
  "vysker",
  "chlum",
  "osoby",
  "osob",
  "lidi",
  "lidi.",
  "hostu",
  "hoste",
  "hod",
  "hod.",
  "h",
]);

const CZECH_KEYBOARD_DIGITS: Record<string, string> = {
  "ě": "2",
  "š": "3",
  "č": "4",
  "ř": "5",
  "ž": "6",
  "ý": "7",
  "á": "8",
  "í": "9",
  "é": "0",
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseEnvMap(rawValue: string | undefined) {
  const map = new Map<string, string>();
  for (const pair of (rawValue ?? "").split(",")) {
    const [key, value] = pair.split(":").map((part) => part?.trim());
    if (key && value) map.set(key, value);
  }
  return map;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeTime(hoursText: string, minutesText?: string) {
  const hours = Number(hoursText);
  const minutes = minutesText == null || minutesText === "" ? 0 : Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function decodeCzechKeyboardDigits(value: string) {
  return value
    .split("")
    .map((char) => CZECH_KEYBOARD_DIGITS[char] ?? char)
    .join("");
}

function normalizeDate(day: number, month: number, yearText?: string) {
  const now = new Date();
  const year = yearText
    ? Number(yearText.length === 2 ? `20${yearText}` : yearText)
    : now.getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  return toDateKey(candidate);
}

function extractDate(rawText: string, normalizedText: string) {
  if (/\bdnes\b/.test(normalizedText)) {
    return { date: toDateKey(new Date()), consumed: "dnes" };
  }
  if (/\bzitra\b/.test(normalizedText)) {
    return { date: toDateKey(addDays(new Date(), 1)), consumed: "zitra" };
  }
  if (/\bpozitri\b/.test(normalizedText)) {
    return { date: toDateKey(addDays(new Date(), 2)), consumed: "pozitri" };
  }

  const isoMatch = normalizedText.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const date = normalizeDate(Number(isoMatch[3]), Number(isoMatch[2]), isoMatch[1]);
    if (date) return { date, consumed: isoMatch[0] };
  }

  const dottedMonthMatch = normalizedText.match(/\b(\d{1,2})\.\s*(ledna|unora|unor|brezna|dubna|kvetna|cervna|cervence|srpna|zari|rijna|listopadu|prosince)(?:\s+(20\d{2}))?\b/);
  if (dottedMonthMatch) {
    const month = CZECH_MONTHS[dottedMonthMatch[2] as MonthName];
    const date = normalizeDate(Number(dottedMonthMatch[1]), month, dottedMonthMatch[3]);
    if (date) return { date, consumed: dottedMonthMatch[0] };
  }

  const dottedMatch = normalizedText.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (dottedMatch) {
    const date = normalizeDate(Number(dottedMatch[1]), Number(dottedMatch[2]), dottedMatch[3]);
    if (date) return { date, consumed: dottedMatch[0] };
  }

  const trailingDotMatch = normalizedText.match(/\b(\d{1,2})\.(\d{1,2})\.(?=\s|$|[),;])/);
  if (trailingDotMatch) {
    const date = normalizeDate(Number(trailingDotMatch[1]), Number(trailingDotMatch[2]));
    if (date) return { date, consumed: trailingDotMatch[0] };
  }

  const noTrailingDotMatch = normalizedText.match(/\b(\d{1,2})\.(\d{1,2})(?=\s|$|[),;.])/);
  if (noTrailingDotMatch) {
    const date = normalizeDate(Number(noTrailingDotMatch[1]), Number(noTrailingDotMatch[2]));
    if (date) return { date, consumed: noTrailingDotMatch[0].trim() };
  }

  return null;
}

function extractTime(normalizedText: string) {
  const colonMatch = normalizedText.match(/\b(?:v|ve|na)?\s*([0-2]?[0-9])(?::([0-5][0-9]))(?:\s*(?:hod|h))?\b/);
  if (colonMatch) {
    const time = normalizeTime(colonMatch[1], colonMatch[2]);
    if (time) return { time, consumed: colonMatch[0].trim() };
  }

  const hourWithSuffixMatch = normalizedText.match(/\b(?:v|ve|na)?\s*([0-2]?[0-9ěščřžýáíé])\s*(?:hod|h)\b/);
  if (hourWithSuffixMatch) {
    const time = normalizeTime(decodeCzechKeyboardDigits(hourWithSuffixMatch[1]));
    if (time) return { time, consumed: hourWithSuffixMatch[0].trim() };
  }

  const bareHourMatch = normalizedText.match(/\b([12][0-9ěščřžýáíé])\b/);
  if (bareHourMatch) {
    const time = normalizeTime(decodeCzechKeyboardDigits(bareHourMatch[1]));
    if (time) return { time, consumed: bareHourMatch[0].trim() };
  }

  const timeMatch = normalizedText.match(/\b(?:v|ve|na)?\s*(\d{1,2})(?::(\d{2}))\b/);
  if (timeMatch) {
    const time = normalizeTime(timeMatch[1], timeMatch[2]);
    if (time) return { time, consumed: timeMatch[0].trim() };
  }

  const hourMatch = normalizedText.match(/\b(?:v|ve|na)\s*(\d{1,2})\b/);
  if (hourMatch) {
    const time = normalizeTime(hourMatch[1]);
    if (time) return { time, consumed: hourMatch[0].trim() };
  }

  return null;
}

function extractPartySize(normalizedText: string) {
  const xMatch = normalizedText.match(/\b(\d{1,2})\s*x\b/);
  if (xMatch) {
    const partySize = Number(xMatch[1]);
    if (partySize >= 1 && partySize <= 40) {
      return { partySize, consumed: xMatch[0] };
    }
  }

  const labelledMatch = normalizedText.match(/\b(\d{1,2})\s*(?:os|os\.|osob|lidi|hostu|hostu\.|hostů)\b/);
  if (labelledMatch) {
    const partySize = Number(labelledMatch[1]);
    if (partySize >= 1 && partySize <= 40) {
      return { partySize, consumed: labelledMatch[0] };
    }
  }

  const proMatch = normalizedText.match(/\bpro\s+(\d{1,2})\b/);
  if (proMatch) {
    const partySize = Number(proMatch[1]);
    if (partySize >= 1 && partySize <= 40) {
      return { partySize, consumed: proMatch[0] };
    }
  }

  return null;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isSkipValue(value: string) {
  const normalized = normalizeText(value);
  return normalized === "skip" || normalized === "-" || normalized === "preskocit" || normalized === "ne";
}

function extractPlainPartySize(normalizedText: string) {
  const match = normalizedText.match(/\b(\d{1,2})\b/);
  if (!match) return null;
  const partySize = Number(match[1]);
  return Number.isInteger(partySize) && partySize >= 1 && partySize <= 40 ? partySize : null;
}

function stripFillerWords(rawValue: string) {
  return collapseWhitespace(
    rawValue
      .split(/\s+/)
      .filter((word) => !FILLER_WORDS.has(normalizeText(word)))
      .join(" "),
  );
}

async function resolveLocation(locationHint: string | null, chatId: string) {
  const locations = filterBaseLocations(await locationsService.loadAll());
  const defaultLocationMap = parseEnvMap(process.env.TELEGRAM_DEFAULT_LOCATION_MAP);
  const defaultHint = defaultLocationMap.get(chatId) ?? "";
  const normalizedHint = normalizeText(locationHint || defaultHint);

  if (!normalizedHint) {
    if (locations.length === 1) return locations[0] ?? null;
    return null;
  }

  return (
    locations.find((location) => normalizeText(location.code) === normalizedHint) ??
    locations.find((location) => normalizeText(location.name).includes(normalizedHint)) ??
    locations.find((location) => normalizeText(`${location.code} ${location.name}`).includes(normalizedHint)) ??
    null
  );
}

async function parseReservationText(rawText: string, chatId: string): Promise<{ ok: true; reservation: ParsedReservation } | { ok: false; error: string }> {
  const [headRaw, noteRaw] = rawText.split(/\s*;\s*/, 2);
  const head = headRaw.replace(/^\/\w+\s*/u, "").trim();
  const normalizedHead = normalizeText(head);
  const location = await resolveLocation(
    (() => {
      const locationMatch = normalizedHead.match(/\b(chlum|vysker)\b/);
      return locationMatch?.[1] ?? null;
    })(),
    chatId,
  );

  if (!location) {
    return {
      ok: false,
      error: "Neznam pobocku. Pouzij treba CHLUM nebo VYSKER, nebo nastav vychozi pobocku pro chat.",
    };
  }

  const dateMatch = extractDate(head, normalizedHead);
  if (!dateMatch) {
    return {
      ok: false,
      error: "Neznam datum. Napis treba 2.5., dnes nebo zitra.",
    };
  }

  const normalizedHeadWithoutDate = collapseWhitespace(
    normalizedHead.replace(new RegExp(normalizeText(dateMatch.consumed).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " "),
  );
  const timeMatch = extractTime(normalizedHeadWithoutDate);
  if (!timeMatch) {
    return {
      ok: false,
      error: "Neznam cas. Napis treba 12:00 nebo ve 12.",
    };
  }

  const partySizeMatch = extractPartySize(normalizedHead);
  if (!partySizeMatch) {
    return {
      ok: false,
      error: "Neznam pocet osob. Napis treba 3 osoby nebo pro 3.",
    };
  }

  const displayName = stripFillerWords(
    head
      .replace(new RegExp(dateMatch.consumed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
      .replace(new RegExp(timeMatch.consumed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
      .replace(new RegExp(partySizeMatch.consumed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
      .replace(/\b(CHLUM|VYSKE[RŘ])\b/gi, " "),
  );

  return {
    ok: true,
    reservation: {
      date: dateMatch.date,
      time: timeMatch.time,
      partySize: partySizeMatch.partySize,
      locationId: location.id,
      name: displayName || undefined,
      notes: noteRaw?.trim() || undefined,
    },
  };
}

function getTelegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!token || !webhookSecret) return null;

  return {
    token,
    webhookSecret,
    chatUserMap: parseEnvMap(process.env.TELEGRAM_CHAT_USER_MAP),
    defaultLocationMap: parseEnvMap(process.env.TELEGRAM_DEFAULT_LOCATION_MAP),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://vysker.com",
  };
}

function revalidateReservationViews(date: string) {
  revalidatePath(workPaths.base);
  revalidatePath(workPaths.employees);
  revalidatePath(workPaths.schedule);
  revalidatePath(workPaths.reservations);
  revalidatePath(workPaths.reservationsQuick);
  revalidatePath(workPaths.reservationsKiosk);
  revalidatePath(`/work/employees/day/${date}`);
}

async function listUpcomingReservationsForActor(userId: string) {
  const actor = await usersService.findById(userId);
  if (!actor) return [];

  const allowedLocationIds = await getAllowedBaseLocationIdsForActor(actor);
  const today = toDateKey(new Date());
  const limitDate = toDateKey(addDays(new Date(), 60));
  const reservations = await baseReservationsService.forDateRange(today, limitDate);
  const locations = filterBaseLocations(await locationsService.loadAll());
  const locationMap = new Map(locations.map((location) => [location.id, location]));

  return reservations
    .filter((reservation) => allowedLocationIds.has(reservation.locationId))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .map((reservation) => ({
      reservation,
      label: `${locationMap.get(reservation.locationId)?.code ?? "POBOCKA"} • ${formatCzDate(reservation.date)} • ${reservation.time} • ${reservation.partySize} osob${reservation.name ? ` • ${reservation.name}` : ""}`,
    }));
}

async function sendTelegramMessage(config: TelegramConfig, chatId: number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: TELEGRAM_MAIN_KEYBOARD,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[telegram] sendMessage failed.", { status: response.status, body });
  }
}

function helpText(siteUrl: string) {
  return [
    "Rezervace bot",
    "",
    "Priklady:",
    "CHLUM 2.5. 12:00 3 osoby",
    "CHLUM 3.3. 13 5x Novak",
    "CHLUM 3.3. 1š hod 5x Novak",
    "VYSKER zitra ve 12 pro 4 ; terasa",
    "/rez chlum dnes 18:30 2 Novak",
    "",
    "Prikazy:",
    "rez - spusti pruvodce krok za krokem",
    "smaz - vypise blizke rezervace a provede smazani",
    "/form - otevre kiosk formular",
    "/pobocky - vypise pobocky",
    "/cancel - zrusi rozdelanou rezervaci",
    "/help - napoveda",
    "",
    `Formular: ${siteUrl}/work/reservations/kiosk`,
  ].join("\n");
}

async function startGuidedReservation(chatId: string, userId: string, defaultLocationId?: string) {
  const session = await telegramReservationSessionsService.start(chatId, userId, "create", defaultLocationId ? "date" : "location");
  if (!session) return null;
  if (defaultLocationId) {
    await telegramReservationSessionsService.update(chatId, { locationId: defaultLocationId });
  }
  return defaultLocationId
    ? "Jdeme na to. Na jaky den to je? Napis treba 2.5., dnes nebo zitra."
    : "Jdeme na to. Napis pobocku: CHLUM nebo VYSKER.";
}

async function startDeleteReservation(chatId: string, userId: string) {
  const upcomingReservations = await listUpcomingReservationsForActor(userId);
  if (upcomingReservations.length === 0) {
    return "Nenasel jsem zadnou blizkou rezervaci ke smazani.";
  }

  const visibleReservations = upcomingReservations.slice(0, 12);
  const session = await telegramReservationSessionsService.start(chatId, userId, "delete", "delete_pick");
  if (!session) return null;

  await telegramReservationSessionsService.update(chatId, {
    reservationIds: visibleReservations.map((item) => item.reservation.id),
  });

  return [
    "Co chces smazat? Posli cislo rezervace.",
    "",
    ...visibleReservations.map((item, index) => `${index + 1}. ${item.label}`),
    "",
    "Kdyz nic nechces mazat, napis /cancel.",
  ].join("\n");
}

async function finalizeGuidedReservation(session: TelegramReservationSessionRecord) {
  const actor = await usersService.findById(session.userId);
  const result = await createBaseReservationForActor(actor, {
    date: session.date ?? "",
    time: session.time ?? "",
    partySize: session.partySize ?? 0,
    locationId: session.locationId ?? "",
    name: session.name || undefined,
    notes: session.notes || undefined,
  });

  await telegramReservationSessionsService.clear(session.chatId);

  if (!result.ok) {
    return `Rezervaci se nepodarilo ulozit: ${result.error}`;
  }

  revalidateReservationViews(session.date ?? "");

  const location = await locationsService.findById(session.locationId ?? "");
  return [
    "Rezervace ulozena.",
    `${location?.code ?? "POBOCKA"} • ${formatCzDate(session.date ?? "")} • ${session.time}`,
    `${session.partySize} osob${session.name ? ` • ${session.name}` : ""}`,
    session.notes ? `Poznamka: ${session.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleDeleteReservationStep(
  session: TelegramReservationSessionRecord,
  rawText: string,
  chatId: string,
): Promise<string> {
  const choice = rawText.trim();

  if (session.step === "delete_pick") {
    const selection = Number(choice);
    if (!Number.isInteger(selection) || selection < 1 || selection > (session.reservationIds?.length ?? 0)) {
      return "Neznam cislo rezervace. Posli cislo ze seznamu, treba 1.";
    }

    const reservationId = session.reservationIds?.[selection - 1];
    if (!reservationId) {
      return "Rezervaci jsem nenasel. Zkus to znovu nebo napis /cancel.";
    }

    const reservation = await baseReservationsService.findById(reservationId);
    if (!reservation) {
      return "Tahle rezervace uz neexistuje. Napis smaz a nactu novy seznam.";
    }

    const location = await locationsService.findById(reservation.locationId);
    await telegramReservationSessionsService.update(chatId, {
      step: "delete_confirm",
      selectedReservationId: reservationId,
    });

    return [
      "Potvrd smazani rezervace odpovedi ANO.",
      `${location?.code ?? "POBOCKA"} • ${formatCzDate(reservation.date)} • ${reservation.time} • ${reservation.partySize} osob${reservation.name ? ` • ${reservation.name}` : ""}`,
      "Kdyz ji nechces smazat, napis NE nebo /cancel.",
    ].join("\n");
  }

  const normalized = normalizeText(choice);
  if (normalized !== "ano") {
    await telegramReservationSessionsService.clear(chatId);
    return "Mazani zruseno.";
  }

  const actor = await usersService.findById(session.userId);
  const result = await deleteBaseReservationForActor(actor, session.selectedReservationId ?? "");
  await telegramReservationSessionsService.clear(chatId);

  if (!result.ok) {
    return `Rezervaci se nepodarilo smazat: ${result.error}`;
  }

  revalidateReservationViews(result.reservation.date);

  const location = await locationsService.findById(result.reservation.locationId);
  return [
    "Rezervace smazana.",
    `${location?.code ?? "POBOCKA"} • ${formatCzDate(result.reservation.date)} • ${result.reservation.time}`,
    `${result.reservation.partySize} osob${result.reservation.name ? ` • ${result.reservation.name}` : ""}`,
  ].join("\n");
}

async function handleGuidedReservationStep(
  session: TelegramReservationSessionRecord,
  rawText: string,
  chatId: string,
): Promise<string> {
  if (session.mode === "delete") {
    return handleDeleteReservationStep(session, rawText, chatId);
  }

  const normalizedText = normalizeText(rawText.trim());

  if (session.step === "location") {
    const location = await resolveLocation(rawText, chatId);
    if (!location) {
      return "Neznam pobocku. Napis CHLUM nebo VYSKER.";
    }
    await telegramReservationSessionsService.update(chatId, {
      step: "date",
      locationId: location.id,
    });
    return `Pobocka ${location.code} je nastavena. Na jaky den to je?`;
  }

  if (session.step === "date") {
    const dateMatch = extractDate(rawText, normalizedText);
    if (!dateMatch) {
      return "Neznam datum. Napis treba 2.5., dnes nebo zitra.";
    }
    await telegramReservationSessionsService.update(chatId, {
      step: "time",
      date: dateMatch.date,
    });
    return `Super. Cas? Napis treba 12:00 nebo ve 12.`;
  }

  if (session.step === "time") {
    const timeMatch = extractTime(normalizedText);
    if (!timeMatch) {
      return "Neznam cas. Napis treba 12:00 nebo ve 12.";
    }
    await telegramReservationSessionsService.update(chatId, {
      step: "party_size",
      time: timeMatch.time,
    });
    return "Pro kolik osob to je?";
  }

  if (session.step === "party_size") {
    const partySize = extractPartySize(normalizedText)?.partySize ?? extractPlainPartySize(normalizedText);
    if (!partySize) {
      return "Neznam pocet osob. Napis treba 3 osoby nebo jen 3.";
    }
    await telegramReservationSessionsService.update(chatId, {
      step: "name",
      partySize,
    });
    return "Chces zadat jmeno? Kdyz nechces, napis skip.";
  }

  if (session.step === "name") {
    await telegramReservationSessionsService.update(chatId, {
      step: "notes",
      name: isSkipValue(rawText) ? undefined : collapseWhitespace(rawText),
    });
    return "A poznamka? Kdyz nic, napis skip.";
  }

  await telegramReservationSessionsService.update(chatId, {
    notes: isSkipValue(rawText) ? undefined : collapseWhitespace(rawText),
  });
  const updatedSession = await telegramReservationSessionsService.findByChatId(chatId);
  if (!updatedSession) {
    return "Rezervaci se nepodarilo dokoncit.";
  }
  return finalizeGuidedReservation(updatedSession);
}

export function getTelegramWebhookSecret() {
  return getTelegramConfig()?.webhookSecret ?? null;
}

export function getTelegramSetupSummary() {
  const config = getTelegramConfig();
  return {
    configured: Boolean(config),
    webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://vysker.com"}/api/telegram/reservations/webhook`,
  };
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<BotReply | null> {
  const config = getTelegramConfig();
  if (!config) {
    return {
      text: "Telegram bot neni nakonfigurovany. Chybi TELEGRAM_BOT_TOKEN nebo TELEGRAM_WEBHOOK_SECRET.",
    };
  }

  const message = update.message ?? update.edited_message;
  if (!message?.text) return null;

  const chatId = String(message.chat.id);
  const normalizedText = normalizeText(message.text.trim());

  if (!config.chatUserMap.has(chatId)) {
    return {
      text: `Tenhle chat neni povoleny. Pridat ho jde pres TELEGRAM_CHAT_USER_MAP. Chat ID: ${chatId}`,
    };
  }

  if (normalizedText === "/start" || normalizedText === "/help") {
    return {
      text: helpText(config.siteUrl),
    };
  }

  if (normalizedText === "/cancel") {
    await telegramReservationSessionsService.clear(chatId);
    return {
      text: "Rozdelana rezervace byla zrusena.",
    };
  }

  if (normalizedText === "/form") {
    return {
      text: `Formular pro rychly zapis: ${config.siteUrl}/work/reservations/kiosk`,
    };
  }

  if (normalizedText === "/pobocky") {
    const locations = filterBaseLocations(await locationsService.loadAll());
    return {
      text: `Pobocky: ${locations.map((location) => `${location.code} (${location.name})`).join(", ")}`,
    };
  }

  const userId = config.chatUserMap.get(chatId);
  const actor = userId ? await usersService.findById(userId) : null;
  const activeSession = await telegramReservationSessionsService.findByChatId(chatId);

  if ((normalizedText === "rez" || normalizedText === "/rez") && userId) {
    const defaultLocationId = config.defaultLocationMap.get(chatId);
    return {
      text: (await startGuidedReservation(chatId, userId, defaultLocationId)) ?? "Nepodarilo se spustit pruvodce.",
    };
  }

  if ((normalizedText === "smaz" || normalizedText === "/smaz") && userId) {
    return {
      text: (await startDeleteReservation(chatId, userId)) ?? "Nepodarilo se spustit mazani rezervace.",
    };
  }

  if (activeSession) {
    return {
      text: await handleGuidedReservationStep(activeSession, message.text, chatId),
    };
  }

  const parsed = await parseReservationText(message.text, chatId);

  if (!parsed.ok) {
    return {
      text: `${parsed.error}\n\n${helpText(config.siteUrl)}`,
    };
  }

  const result = await createBaseReservationForActor(actor, parsed.reservation);
  if (!result.ok) {
    return {
      text: `Rezervaci se nepodarilo ulozit: ${result.error}`,
    };
  }

  revalidateReservationViews(parsed.reservation.date);

  const location = await locationsService.findById(parsed.reservation.locationId);
  return {
    text: [
      "Rezervace ulozena.",
      `${location?.code ?? "POBOCKA"} • ${formatCzDate(parsed.reservation.date)} • ${parsed.reservation.time}`,
      `${parsed.reservation.partySize} osob${parsed.reservation.name ? ` • ${parsed.reservation.name}` : ""}`,
      parsed.reservation.notes ? `Poznamka: ${parsed.reservation.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function replyToTelegramUpdate(update: TelegramUpdate) {
  const config = getTelegramConfig();
  if (!config) return;
  const message = update.message ?? update.edited_message;
  if (!message) return;
  const reply = await handleTelegramUpdate(update);
  if (!reply?.text) return;
  await sendTelegramMessage(config, message.chat.id, reply.text);
}
