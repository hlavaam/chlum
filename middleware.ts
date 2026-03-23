import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_COOKIE = "maintenance_access";
const ACCESS_COOKIE_VALUE = "granted";
const MAINTENANCE_PATH = "/maintenance";
const ACCESS_API_PATH = "/api/maintenance/access";

function isPublicAsset(pathname: string) {
  return pathname.startsWith("/_next/") || pathname === "/favicon.ico" || /\.[a-zA-Z0-9]+$/.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAccess = request.cookies.get(ACCESS_COOKIE)?.value === ACCESS_COOKIE_VALUE;

  if (isPublicAsset(pathname) || pathname === ACCESS_API_PATH) {
    return NextResponse.next();
  }

  if (pathname === MAINTENANCE_PATH) {
    return NextResponse.next();
  }

  if (hasAccess) {
    return NextResponse.next();
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
