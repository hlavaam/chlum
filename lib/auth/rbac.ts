import { redirect } from "next/navigation";

import { staffPaths } from "@/lib/paths";
import { getCurrentUser } from "@/lib/auth/session";
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
  if (!roles.includes(user.role)) {
    redirect(options.fallbackPath ?? staffPaths.employees);
  }
  return user;
}

export function assertRole(user: UserRecord | null, roles: AppRole[]) {
  if (!user) throw new Error("Unauthenticated");
  if (!roles.includes(user.role)) throw new Error("Forbidden");
}
