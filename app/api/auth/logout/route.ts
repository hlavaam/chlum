import { NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName);
  return response;
}
