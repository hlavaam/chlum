import { isBaseRole, isManagerRole } from "@/lib/auth/role-access";
import { workPaths } from "@/lib/paths";
import type { AppRole } from "@/types/models";

export function getDefaultPostLoginPath(role: AppRole) {
  if (isBaseRole(role)) {
    return workPaths.base;
  }

  return isManagerRole(role) ? workPaths.schedule : workPaths.employees;
}
