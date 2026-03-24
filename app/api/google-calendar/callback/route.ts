import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { calendarConnectionsService } from "@/lib/services/calendar-connections";
import { exchangeGoogleAuthCode, syncUpcomingGoogleCalendarForUser } from "@/lib/services/google-calendar-sync";

const STATE_COOKIE = "google_calendar_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;

  if (error || !code || !stateCookie) {
    return NextResponse.redirect(new URL("/work/employees/my?google=error", request.url));
  }

  const parsed = JSON.parse(stateCookie) as { state?: string; userId?: string; next?: string; redirectUri?: string };
  const redirectUri = parsed.redirectUri || new URL("/api/google-calendar/callback", request.url).toString();
  if (!parsed.state || parsed.state !== state || !parsed.userId) {
    return NextResponse.redirect(new URL("/work/employees/my?google=error", request.url));
  }

  const tokens = await exchangeGoogleAuthCode(code, redirectUri);
  if (!tokens?.access_token) {
    return NextResponse.redirect(new URL("/work/employees/my?google=error", request.url));
  }

  const existing = await calendarConnectionsService.findGoogleByUser(parsed.userId);
  const payload = {
    userId: parsed.userId,
    provider: "google" as const,
    calendarId: "primary",
    refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? "",
    accessToken: tokens.access_token,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scope: tokens.scope,
  };

  if (existing) {
    await calendarConnectionsService.update(existing.id, payload);
  } else {
    await calendarConnectionsService.create(payload);
  }
  await syncUpcomingGoogleCalendarForUser(parsed.userId);

  const response = NextResponse.redirect(new URL(`${parsed.next ?? "/work/employees/my"}?google=connected`, request.url));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
