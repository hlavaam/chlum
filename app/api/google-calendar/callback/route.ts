import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { calendarConnectionsService } from "@/lib/services/calendar-connections";
import { exchangeGoogleAuthCode, syncUpcomingGoogleCalendarForUser } from "@/lib/services/google-calendar-sync";

const STATE_COOKIE = "google_calendar_state";

function getCanonicalSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://vysker.com";
}

function getStateCookieDomain() {
  const hostname = new URL(getCanonicalSiteUrl()).hostname;
  return hostname.endsWith("vysker.com") ? ".vysker.com" : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;

  if (error || !code || !stateCookie) {
    return NextResponse.redirect(new URL("/work/employees/my?google=error", getCanonicalSiteUrl()));
  }

  const parsed = JSON.parse(stateCookie) as { state?: string; userId?: string; next?: string; redirectUri?: string };
  const redirectUri = parsed.redirectUri || new URL("/api/google-calendar/callback", getCanonicalSiteUrl()).toString();
  if (!parsed.state || parsed.state !== state || !parsed.userId) {
    return NextResponse.redirect(new URL("/work/employees/my?google=error", getCanonicalSiteUrl()));
  }

  const tokens = await exchangeGoogleAuthCode(code, redirectUri);
  if (!tokens?.access_token) {
    return NextResponse.redirect(new URL("/work/employees/my?google=error", getCanonicalSiteUrl()));
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

  const redirectPath = `${parsed.next ?? "/work/employees/my"}?google=connected`;
  const response = NextResponse.redirect(new URL(redirectPath, getCanonicalSiteUrl()));
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    domain: getStateCookieDomain(),
    maxAge: 0,
  });
  return response;
}
