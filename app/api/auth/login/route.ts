import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieName } from "@/lib/auth/session";
import { serializeRecord } from "@/lib/serializers";
import { usersService } from "@/lib/services/users";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const user = await usersService.findByEmail(email);

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ user: serializeRecord("users", user) });
  response.cookies.set(sessionCookieName, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
