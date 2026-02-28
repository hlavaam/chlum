import { createHmac, timingSafeEqual } from "crypto";

import { cookies } from "next/headers";
import { cache } from "react";

import { startPerfTrace } from "@/lib/perf";
import { usersService } from "@/lib/services/users";
import type { UserRecord } from "@/types/models";

const COOKIE_NAME = "employees_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

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

const resolveCurrentUser = cache(async (): Promise<UserRecord | null> => {
  const trace = startPerfTrace("auth.get_current_user");
  try {
    const cookieStore = await cookies();
    trace.step("cookies");
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
      trace.end({ result: "no_token" });
      return null;
    }
    const parsed = verifySessionToken(token);
    trace.step("verify_token", { valid: Boolean(parsed) });
    if (!parsed) {
      trace.end({ result: "invalid_token" });
      return null;
    }
    const user = await usersService.findById(parsed.userId);
    trace.step("load_user", { found: Boolean(user), user_id: parsed.userId });
    if (!user || !user.active) {
      trace.end({ result: "inactive_or_missing" });
      return null;
    }
    trace.end({ result: "ok", role: user.role });
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
  cookieStore.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const sessionCookieName = COOKIE_NAME;
