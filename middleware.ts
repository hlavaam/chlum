import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_COOKIE = "maintenance_access";
const ACCESS_COOKIE_VALUE = "granted";
const MAINTENANCE_PATH = "/maintenance";
const ACCESS_API_PATH = "/api/maintenance/access";
const WORK_PATH_PREFIX = "/work";
const WORK_API_PREFIXES = ["/api/auth/", "/api/me", "/api/shifts/", "/api/google-calendar/", "/api/work/base/", "/api/telegram/"];

function isPublicAsset(pathname: string) {
  return pathname.startsWith("/_next/") || pathname === "/favicon.ico" || /\.[a-zA-Z0-9]+$/.test(pathname);
}

function isWorkPath(pathname: string) {
  return pathname === WORK_PATH_PREFIX || pathname.startsWith(`${WORK_PATH_PREFIX}/`);
}

function isWorkApiPath(pathname: string) {
  return WORK_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAccess = request.cookies.get(ACCESS_COOKIE)?.value === ACCESS_COOKIE_VALUE;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname === "/" ? "/" : `${pathname}${search}`);

  if (isPublicAsset(pathname) || pathname === ACCESS_API_PATH || isWorkPath(pathname) || isWorkApiPath(pathname)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (pathname === MAINTENANCE_PATH) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (hasAccess) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Web je momentalne v pripravach." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const target = new URL(MAINTENANCE_PATH, request.url);
  target.searchParams.set("next", pathname === "/" ? "/" : `${pathname}${search}`);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
