import { NextResponse } from "next/server";

import { setWorkBaseAccessCookie } from "@/lib/auth/session";

const BASE_PASSWORD = "cerna";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password.trim() : "";

  if (password !== BASE_PASSWORD) {
    return NextResponse.json({ error: "Neplatné heslo." }, { status: 401 });
  }

  await setWorkBaseAccessCookie();
  return NextResponse.json({ ok: true });
}
