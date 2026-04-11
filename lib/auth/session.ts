import { createHmac, timingSafeEqual } from "crypto";

import type { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { startPerfTrace } from "@/lib/perf";
import { usersService } from "@/lib/services/users";
import type { UserRecord } from "@/types/models";

const COOKIE_NAME = "employees_session";
const FALLBACK_COOKIE_NAME = "employees_session_fallback";
const BASE_ACCESS_COOKIE_NAME = "work_base_access";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const BASE_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type AuthTokenSource = "session_cookie" | "fallback_cookie" | "authorization_header" | "none";

function getSecret() {
  return process.env.SESSION_SECRET || "dev-session-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createSessionToken(userId: string): string {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): { userId: string; expiresAt: number } | null {
  const [userId, expiresText, signature] = token.split(".");
  if (!userId || !expiresText || !signature) return null;
  const payload = `${userId}.${expiresText}`;
  const expected = Buffer.from(sign(payload), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;
  const expiresAt = Number(expiresText);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return { userId, expiresAt };
}

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

function getSessionCookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    secure: isSecureCookie(),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function getSessionCookieDebugOptions() {
  return {
    sameSite: "lax" as const,
    secure: isSecureCookie(),
    httpOnly: true,
    fallbackHttpOnly: false,
    path: "/",
    domain: null,
    maxAge: MAX_AGE_SECONDS,
  };
}

function parseBearerToken(value: string | null): string | null {
  if (!value) return null;
  const [scheme, token] = value.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export async function getRequestSessionToken(): Promise<{ token: string | null; source: AuthTokenSource }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    return { token, source: "session_cookie" };
  }

  const fallbackToken = cookieStore.get(FALLBACK_COOKIE_NAME)?.value;
  if (fallbackToken) {
    return { token: fallbackToken, source: "fallback_cookie" };
  }

  const headerStore = await headers();
  const headerToken = parseBearerToken(headerStore.get("authorization"));
  if (headerToken) {
    return { token: headerToken, source: "authorization_header" };
  }

  return { token: null, source: "none" };
}

function setSessionCookiesOnWritableStore(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  token: string,
) {
  cookieStore.set(COOKIE_NAME, token, getSessionCookieOptions(true));
  cookieStore.set(FALLBACK_COOKIE_NAME, token, getSessionCookieOptions(false));
}

export function setSessionCookiesOnResponse(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, getSessionCookieOptions(true));
  response.cookies.set(FALLBACK_COOKIE_NAME, token, getSessionCookieOptions(false));
}

export function clearSessionCookiesOnResponse(response: NextResponse) {
  response.cookies.delete(COOKIE_NAME);
  response.cookies.delete(FALLBACK_COOKIE_NAME);
}

function createScopedToken(scope: string, maxAgeSeconds: number) {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const payload = `${scope}.${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifyScopedToken(token: string, scope: string): boolean {
  const [tokenScope, expiresText, signature] = token.split(".");
  if (!tokenScope || !expiresText || !signature || tokenScope !== scope) return false;
  const payload = `${tokenScope}.${expiresText}`;
  const expected = Buffer.from(sign(payload), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length) return false;
  if (!timingSafeEqual(expected, received)) return false;
  const expiresAt = Number(expiresText);
  return Number.isFinite(expiresAt) && Date.now() <= expiresAt;
}

const resolveCurrentUser = cache(async (): Promise<UserRecord | null> => {
  const trace = startPerfTrace("auth.get_current_user");
  try {
    const { token, source } = await getRequestSessionToken();
    trace.step("token_lookup", { source });
    if (!token) {
      trace.end({ result: "no_token" });
      return null;
    }
    const parsed = verifySessionToken(token);
    trace.step("verify_token", { valid: Boolean(parsed), source });
    if (!parsed) {
      console.warn("[auth] Ignoring invalid authentication token.", { source });
      trace.end({ result: "invalid_token" });
      return null;
    }
    const user = await usersService.findById(parsed.userId);
    trace.step("load_user", { found: Boolean(user), user_id: parsed.userId, source });
    if (!user || !user.active) {
      console.warn("[auth] Authentication resolved to missing or inactive user.", { source, userId: parsed.userId });
      trace.end({ result: "inactive_or_missing" });
      return null;
    }
    trace.end({ result: "ok", role: user.role, source });
    return user;
  } catch (error) {
    trace.fail(error);
    throw error;
  }
});

export async function getCurrentUser(): Promise<UserRecord | null> {
  return resolveCurrentUser();
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  setSessionCookiesOnWritableStore(cookieStore, createSessionToken(userId));
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(FALLBACK_COOKIE_NAME);
}

export const sessionCookieName = COOKIE_NAME;
export const fallbackSessionCookieName = FALLBACK_COOKIE_NAME;

export async function hasWorkBaseAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get(BASE_ACCESS_COOKIE_NAME)?.value;
  return token ? verifyScopedToken(token, "work_base_access") : false;
}

export async function setWorkBaseAccessCookie() {
  const cookieStore = await cookies();
  cookieStore.set(BASE_ACCESS_COOKIE_NAME, createScopedToken("work_base_access", BASE_ACCESS_MAX_AGE_SECONDS), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: BASE_ACCESS_MAX_AGE_SECONDS,
  });
}
