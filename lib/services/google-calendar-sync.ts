import { addDays, nowIso, parseDateKey, toDateKey } from "@/lib/utils";
import { assignmentsService } from "@/lib/services/assignments";
import { calendarConnectionsService } from "@/lib/services/calendar-connections";
import { calendarSyncsService } from "@/lib/services/calendar-syncs";
import { locationsService } from "@/lib/services/locations";
import { shiftsService } from "@/lib/services/shifts";
import { usersService } from "@/lib/services/users";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_TIMEZONE = "Europe/Prague";

type TokenPayload = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleCalendarConfigured() {
  return Boolean(getGoogleConfig());
}

export function buildGoogleCalendarAuthUrl(state: string, redirectUri: string) {
  const config = getGoogleConfig();
  if (!config) return null;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function eventDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function resolveShiftEnd(date: string, endTime: string) {
  if (/^\d{2}:\d{2}$/.test(endTime)) return eventDateTime(date, endTime);
  const start = parseDateKey(date);
  const fallback = addDays(start, 0);
  fallback.setHours(20, 0, 0, 0);
  return `${toDateKey(fallback)}T20:00:00`;
}

function buildEventPayload(params: {
  shift: Awaited<ReturnType<typeof shiftsService.findById>> extends infer T ? NonNullable<T> : never;
  staffRole: string;
  location: Awaited<ReturnType<typeof locationsService.findById>> extends infer T ? T : never;
}) {
  const { shift, staffRole, location } = params;
  return {
    summary: `Směna • ${location?.name ?? "Restaurace Vyskeř"}`,
    description: [
      `Role: ${staffRole}`,
      `Typ: ${shift.type}`,
      shift.notes ? `Poznámka: ${shift.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    location: location?.address ?? location?.name ?? "Vyskeř",
    start: {
      dateTime: eventDateTime(shift.date, shift.startTime),
      timeZone: GOOGLE_TIMEZONE,
    },
    end: {
      dateTime: resolveShiftEnd(shift.date, shift.endTime),
      timeZone: GOOGLE_TIMEZONE,
    },
  };
}

async function exchangeRefreshToken(refreshToken: string): Promise<TokenPayload | null> {
  const config = getGoogleConfig();
  if (!config) return null;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function exchangeGoogleAuthCode(code: string, redirectUri: string) {
  const config = getGoogleConfig();
  if (!config) return null;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) return null;
  return response.json() as Promise<TokenPayload>;
}

async function ensureAccessToken(userId: string) {
  const connection = await calendarConnectionsService.findGoogleByUser(userId);
  if (!connection) return null;

  if (
    connection.accessToken &&
    connection.accessTokenExpiresAt &&
    new Date(connection.accessTokenExpiresAt).getTime() > Date.now() + 60_000
  ) {
    return { connection, accessToken: connection.accessToken };
  }

  const refreshed = await exchangeRefreshToken(connection.refreshToken);
  if (!refreshed?.access_token) return null;
  const accessTokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  const updated = await calendarConnectionsService.update(connection.id, {
    accessToken: refreshed.access_token,
    accessTokenExpiresAt,
    scope: refreshed.scope ?? connection.scope,
  });
  return {
    connection: updated ?? connection,
    accessToken: refreshed.access_token,
  };
}

async function googleCalendarRequest(
  userId: string,
  path: string,
  init: RequestInit,
) {
  const auth = await ensureAccessToken(userId);
  if (!auth) return null;
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export async function upsertGoogleCalendarEventForAssignment(userId: string, shiftId: string) {
  if (!isGoogleCalendarConfigured()) return;
  const [connection, user, shift] = await Promise.all([
    calendarConnectionsService.findGoogleByUser(userId),
    usersService.findById(userId),
    shiftsService.findById(shiftId),
  ]);
  if (!connection || !user || !shift) return;
  const assignment = (await assignmentsService.forShift(shiftId)).find((item) => item.userId === userId);
  if (!assignment || assignment.status !== "confirmed") return;
  const location = await locationsService.findById(shift.locationId);
  const sync = await calendarSyncsService.findByUserAndShift(userId, shiftId);
  const payload = buildEventPayload({
    shift,
    staffRole: assignment.staffRole,
    location,
  });

  if (sync) {
    await googleCalendarRequest(userId, `/calendars/primary/events/${sync.eventId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    await calendarSyncsService.update(sync.id, { status: "active", syncedAt: nowIso() });
    return;
  }

  const created = await googleCalendarRequest(userId, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const eventId = typeof created?.id === "string" ? created.id : null;
  if (!eventId) return;
  await calendarSyncsService.create({
    userId,
    shiftId,
    connectionId: connection.id,
    eventId,
    status: "active",
    syncedAt: nowIso(),
  });
}

export async function deleteGoogleCalendarEventForAssignment(userId: string, shiftId: string) {
  const sync = await calendarSyncsService.findByUserAndShift(userId, shiftId);
  if (!sync) return;
  await googleCalendarRequest(userId, `/calendars/primary/events/${sync.eventId}`, {
    method: "DELETE",
  });
  await calendarSyncsService.delete(sync.id);
}

export async function syncGoogleCalendarForShift(shiftId: string) {
  const assignments = await assignmentsService.forShift(shiftId);
  for (const assignment of assignments) {
    if (assignment.status === "confirmed") {
      await upsertGoogleCalendarEventForAssignment(assignment.userId, shiftId);
    } else {
      await deleteGoogleCalendarEventForAssignment(assignment.userId, shiftId);
    }
  }
}

export async function syncUpcomingGoogleCalendarForUser(userId: string) {
  const assignments = await assignmentsService.forUser(userId);
  for (const assignment of assignments) {
    await upsertGoogleCalendarEventForAssignment(userId, assignment.shiftId);
  }
}
