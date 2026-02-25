import { staffRoleLabels, shiftTypeLabels } from "@/lib/constants";
import { formatRequirements } from "@/lib/format";
import { classNames } from "@/lib/utils";
import type { RoleRequirement, ShiftType } from "@/types/models";

export function ShiftTypeBadge({ type }: { type: ShiftType | "mixed" }) {
  const label = type === "mixed" ? "Kombinace" : shiftTypeLabels[type];
  return <span className={classNames("badge", `type-${type}`)}>{label}</span>;
}

export function RequirementsText({ requirements }: { requirements: RoleRequirement[] }) {
  return <span>{formatRequirements(requirements)}</span>;
}

export function StaffRoleBadge({ role }: { role: keyof typeof staffRoleLabels }) {
  return <span className="badge neutral">{staffRoleLabels[role]}</span>;
}
