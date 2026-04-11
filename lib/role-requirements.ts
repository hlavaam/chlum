import type { RoleRequirement } from "@/types/models";

export function formatRoleRequirementTime(requirement: Pick<RoleRequirement, "startTime" | "endTime" | "endTimeFlexible">) {
  if ("endTimeFlexible" in requirement && requirement.endTimeFlexible && requirement.startTime) {
    return `${requirement.startTime}-dle situace`;
  }
  if ("endTimeFlexible" in requirement && requirement.endTimeFlexible) {
    return "dle situace";
  }
  if (requirement.startTime && requirement.endTime) {
    return `${requirement.startTime}-${requirement.endTime}`;
  }
  if (requirement.startTime) {
    return `od ${requirement.startTime}`;
  }
  if (requirement.endTime) {
    return `do ${requirement.endTime}`;
  }
  return "";
}
