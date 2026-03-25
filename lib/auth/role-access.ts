import { APP_ROLES } from "@/lib/constants";
import type { AppRole } from "@/types/models";

export function isSuperAdminRole(role: AppRole) {
  return role === "superadmin";
}

export function isBaseRole(role: AppRole) {
  return role === "base";
}

export function isAdminRole(role: AppRole) {
  return role === "admin" || isSuperAdminRole(role);
}

export function isManagerRole(role: AppRole) {
  return role === "manager" || isAdminRole(role);
}

export function canUseWorkRole(role: AppRole) {
  return role === "brigadnik" || isManagerRole(role);
}

export function canUseBaseTerminalRole(role: AppRole) {
  return isBaseRole(role) || isManagerRole(role);
}

export function hasRoleAccess(role: AppRole, allowedRoles: AppRole[]) {
  return allowedRoles.includes(role) || isSuperAdminRole(role);
}

export function canChangeUserRole(actorRole: AppRole, targetRole: AppRole) {
  if (!isManagerRole(actorRole)) return false;
  if (actorRole === "manager") return !isAdminRole(targetRole);
  return true;
}

export function getAssignableRoles(actorRole: AppRole) {
  if (!isManagerRole(actorRole)) return [] as AppRole[];
  if (actorRole === "manager") return APP_ROLES.filter((role) => !isAdminRole(role));
  return APP_ROLES;
}
