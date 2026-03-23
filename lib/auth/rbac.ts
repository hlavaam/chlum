import { redirect } from "next/navigation";

import { staffPaths } from "@/lib/paths";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAccess } from "@/lib/auth/role-access";
import type { AppRole, UserRecord } from "@/types/models";

type AuthRedirectOptions = {
  loginPath?: string;
  fallbackPath?: string;
};

export async function requireUser(options: AuthRedirectOptions = {}): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(options.loginPath ?? staffPaths.login);
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
