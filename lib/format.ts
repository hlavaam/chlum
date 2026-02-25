import { staffRoleLabels, shiftTypeLabels } from "@/lib/constants";
import type { RoleRequirement } from "@/types/models";

export function formatRequirements(requirements: RoleRequirement[]): string {
  if (!requirements.length) return "bez specifikace";
  return requirements.map((r) => `${r.count} ${staffRoleLabels[r.role]}`).join(", ");
}

export function formatDayTypeLabel(type: "restaurant" | "wedding" | "event" | "mixed") {
  if (type === "mixed") return "Kombinace";
  return shiftTypeLabels[type];
}
