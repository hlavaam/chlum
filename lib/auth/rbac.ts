import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import type { AppRole, UserRecord } from "@/types/models";

export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRoles(roles: AppRole[]): Promise<UserRecord> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/employees");
  }
  return user;
}

export function assertRole(user: UserRecord | null, roles: AppRole[]) {
  if (!user) throw new Error("Unauthenticated");
  if (!roles.includes(user.role)) throw new Error("Forbidden");
}
