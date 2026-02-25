import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { serializeRecord } from "@/lib/serializers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: serializeRecord("users", user) });
}
