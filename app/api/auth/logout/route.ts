import { NextResponse } from "next/server";

import { clearSessionCookiesOnResponse } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookiesOnResponse(response);
  console.info("[auth] Logout cleared session cookies.");
  return response;
}
