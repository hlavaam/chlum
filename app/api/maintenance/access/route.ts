import { NextResponse } from "next/server";

const ACCESS_COOKIE = "maintenance_access";
const ACCESS_COOKIE_VALUE = "granted";
const PREVIEW_PASSWORD = "cerna";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { password?: string; next?: string } | null;
  const password = body?.password?.trim() ?? "";

  if (password !== PREVIEW_PASSWORD) {
    return NextResponse.json({ error: "Nespravne heslo." }, { status: 401 });
  }

  const nextPath = typeof body?.next === "string" && body.next.startsWith("/") ? body.next : "/";
  const response = NextResponse.json({ ok: true, next: nextPath });
  response.cookies.set(ACCESS_COOKIE, ACCESS_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
