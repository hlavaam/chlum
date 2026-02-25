import { createHmac, timingSafeEqual } from "crypto";

import { cookies } from "next/headers";

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

export async function getCurrentUser(): Promise<UserRecord | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const parsed = verifySessionToken(token);
  if (!parsed) return null;
  const user = await usersService.findById(parsed.userId);
  if (!user || !user.active) return null;
  return user;
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
