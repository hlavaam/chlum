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
