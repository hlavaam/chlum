"use client";

import { useState } from "react";

import { STAFF_ROLES, staffRoleLabels } from "@/lib/constants";
import type { RoleRequirement } from "@/types/models";

type Props = {
  requiredRoles?: RoleRequirement[];
  defaultStartTime?: string;
  defaultEndTime?: string;
};

function findRoleRequirement(requiredRoles: RoleRequirement[] | undefined, role: (typeof STAFF_ROLES)[number]) {
  return requiredRoles?.find((item) => item.role === role) ?? null;
}

export function RoleRequirementFields({ requiredRoles, defaultStartTime = "10:00", defaultEndTime = "22:00" }: Props) {
  const [flexibleByRole, setFlexibleByRole] = useState<Record<string, boolean>>(
    Object.fromEntries(
      STAFF_ROLES.map((role) => {
        const current = findRoleRequirement(requiredRoles, role);
        return [role, Boolean(current?.endTimeFlexible)];
      }),
    ),
  );

  return (
    <>
      {STAFF_ROLES.map((role) => {
        const current = findRoleRequirement(requiredRoles, role);
        const flexible = flexibleByRole[role] ?? false;

        return (
          <div key={`role-fields-${role}`} className="role-requirement-editor">
            <label>
              {staffRoleLabels[role]} potrebujeme
              <input type="number" min={0} name={`${role}Count`} defaultValue={current?.count ?? 0} />
            </label>
            <label>
              {staffRoleLabels[role]} od
              <input type="time" name={`${role}StartTime`} defaultValue={current?.startTime ?? defaultStartTime} />
            </label>
            <label>
              {staffRoleLabels[role]} do
              <input
                type="time"
                name={`${role}EndTime`}
                defaultValue={current?.endTime ?? defaultEndTime}
                disabled={flexible}
              />
            </label>
            <label className="inline role-flexible-toggle">
              <input
                type="checkbox"
                name={`${role}EndTimeFlexible`}
                checked={flexible}
                onChange={(event) =>
                  setFlexibleByRole((currentState) => ({
                    ...currentState,
                    [role]: event.target.checked,
                  }))
                }
              />
              {staffRoleLabels[role]} do podle situace
            </label>
          </div>
        );
      })}
    </>
  );
}
