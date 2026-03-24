import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { buildGoogleCalendarAuthUrl, isGoogleCalendarConfigured } from "@/lib/services/google-calendar-sync";

const STATE_COOKIE = "google_calendar_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/work/employees/my";
  const unavailableTarget = `${next}${next.includes("?") ? "&" : "?"}google=unavailable`;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/work?error=auth", request.url));
  }
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL(unavailableTarget, request.url));
  }
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/google-calendar/callback", request.url).toString();
  const authUrl = buildGoogleCalendarAuthUrl(state, redirectUri);
  if (!authUrl) {
    return NextResponse.redirect(new URL(unavailableTarget, request.url));
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, userId: user.id, next, redirectUri }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
