import { NextResponse } from "next/server";

import { getDefaultPostLoginPath } from "@/lib/auth/login-target";
import {
  createSessionToken,
  getCurrentUser,
  getRequestSessionToken,
  getSessionCookieDebugOptions,
  setSessionCookiesOnResponse,
} from "@/lib/auth/session";
import { serializeRecord } from "@/lib/serializers";

export async function POST() {
  const [user, authState] = await Promise.all([getCurrentUser(), getRequestSessionToken()]);

  if (!user) {
    console.warn("[auth] Session restore failed: missing valid bearer or fallback token.");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const token = createSessionToken(user.id);
  const response = NextResponse.json({
    ok: true,
    token,
    redirectTo: getDefaultPostLoginPath(user.role),
    user: serializeRecord("users", user),
    debug: {
      authSource: authState.source,
      cookie: getSessionCookieDebugOptions(),
      restored: true,
    },
  });

  setSessionCookiesOnResponse(response, token);

  console.info("[auth] Session restored from fallback token.", {
    userId: user.id,
    role: user.role,
    authSource: authState.source,
    cookie: getSessionCookieDebugOptions(),
  });

  return response;
}
