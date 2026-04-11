import { NextResponse } from "next/server";

import { getDefaultPostLoginPath } from "@/lib/auth/login-target";
import { isManagerRole } from "@/lib/auth/role-access";
import { adminPaths } from "@/lib/paths";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieDebugOptions, setSessionCookiesOnResponse } from "@/lib/auth/session";
import { serializeRecord } from "@/lib/serializers";
import { usersService } from "@/lib/services/users";

function normalizeNextPath(value: string) {
  return value.startsWith("/") ? value : "";
}

function escapeForInlineScript(value: string) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildLegacyRedirectHtml(token: string, target: string) {
  const safeToken = escapeForInlineScript(token);
  const safeTarget = escapeForInlineScript(target);

  return `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Přihlašuji…</title>
  </head>
  <body>
    <p>Prihlasuji, pockej prosim…</p>
    <script>
      (function () {
        var token = ${safeToken};
        var target = ${safeTarget};
        try {
          window.localStorage.setItem("employees_access_token", token);
        } catch (error) {}
        try {
          var secure = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = "employees_session_fallback=" + encodeURIComponent(token) + "; Max-Age=1209600; Path=/; SameSite=Lax" + secure;
        } catch (error) {}
        window.location.replace(target);
      })();
    </script>
    <noscript>
      <meta http-equiv="refresh" content="0;url=${target}" />
    </noscript>
  </body>
</html>`;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isJsonRequest = contentType.includes("application/json");
  const body = isJsonRequest ? await request.json().catch(() => null) : await request.formData().catch(() => null);
  const email = typeof body?.get === "function"
    ? (typeof body.get("email") === "string" ? String(body.get("email")) : "")
    : (typeof body?.email === "string" ? body.email : "");
  const password = typeof body?.get === "function"
    ? (typeof body.get("password") === "string" ? String(body.get("password")) : "")
    : (typeof body?.password === "string" ? body.password : "");
  const requestedNext = typeof body?.get === "function"
    ? normalizeNextPath(typeof body.get("next") === "string" ? String(body.get("next")) : "")
    : normalizeNextPath(typeof body?.next === "string" ? body.next : "");
  const loginPath = typeof body?.get === "function"
    ? normalizeNextPath(typeof body.get("loginPath") === "string" ? String(body.get("loginPath")) : "") || "/work"
    : normalizeNextPath(typeof body?.loginPath === "string" ? body.loginPath : "") || "/work";
  const isAdminLogin = loginPath.startsWith("/admin");
  const user = await usersService.findByEmail(email);
  const passwordValid = user ? verifyPassword(password, user.passwordHash) : false;

  if (!user || !user.active || !passwordValid || (isAdminLogin && !isManagerRole(user.role))) {
    console.warn("[auth] Login failed.", {
      email,
      reason: !user ? "missing_user" : !user.active ? "inactive_user" : !passwordValid ? "invalid_password" : "role_not_allowed",
      loginPath,
    });
    if (!isJsonRequest) {
      const target = new URL(loginPath, request.url);
      target.searchParams.set("error", "1");
      if (requestedNext) {
        target.searchParams.set("next", requestedNext);
      }
      return NextResponse.redirect(target);
    }
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken(user.id);
  const redirectTo = requestedNext || (isAdminLogin ? adminPaths.root : getDefaultPostLoginPath(user.role));
  const response = isJsonRequest
    ? NextResponse.json({
        ok: true,
        token,
        redirectTo,
        user: serializeRecord("users", user),
        debug: {
          cookie: getSessionCookieDebugOptions(),
          transport: "cookie_and_bearer_fallback",
        },
      })
    : new NextResponse(buildLegacyRedirectHtml(token, redirectTo), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
  setSessionCookiesOnResponse(response, token);

  console.info("[auth] Login succeeded.", {
    email,
    userId: user.id,
    role: user.role,
    mode: isJsonRequest ? "json" : "form_post",
    redirectTo,
    cookie: getSessionCookieDebugOptions(),
  });

  return response;
}
