import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { staffPaths } from "@/lib/paths";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAccess } from "@/lib/auth/role-access";
import type { AppRole, UserRecord } from "@/types/models";

type AuthRedirectOptions = {
  loginPath?: string;
  fallbackPath?: string;
};

async function resolveLoginPath(loginPath?: string) {
  const basePath = loginPath ?? staffPaths.login;
  const requestHeaders = await headers();
  const nextPath = requestHeaders.get("x-pathname");

  if (!nextPath || !nextPath.startsWith("/")) {
    return basePath;
  }

  const target = new URL(basePath, "http://localhost");
  target.searchParams.set("next", nextPath);
  return `${target.pathname}${target.search}`;
}

export async function requireUser(options: AuthRedirectOptions = {}): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(await resolveLoginPath(options.loginPath));
  }
  return user;
}

export async function requireRoles(roles: AppRole[], options: AuthRedirectOptions = {}): Promise<UserRecord> {
  const user = await requireUser(options);
  if (!hasRoleAccess(user.role, roles)) {
    redirect(options.fallbackPath ?? staffPaths.employees);
  }
  return user;
}

export function assertRole(user: UserRecord | null, roles: AppRole[]) {
  if (!user) throw new Error("Unauthenticated");
  if (!hasRoleAccess(user.role, roles)) throw new Error("Forbidden");
}
