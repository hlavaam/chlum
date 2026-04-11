import { NextResponse } from "next/server";

import { getCurrentUser, getRequestSessionToken } from "@/lib/auth/session";
import { serializeRecord } from "@/lib/serializers";

export async function GET() {
  const [user, authState] = await Promise.all([getCurrentUser(), getRequestSessionToken()]);
  if (!user) {
    return NextResponse.json({ user: null, debug: { authSource: authState.source } }, { status: 401 });
  }
  return NextResponse.json({ user: serializeRecord("users", user), debug: { authSource: authState.source } });
}
