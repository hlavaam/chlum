import { assignmentsService } from "@/lib/services/assignments";
import { eventsService } from "@/lib/services/events";
import { locationsService } from "@/lib/services/locations";
import { shiftsService } from "@/lib/services/shifts";
import { usersService } from "@/lib/services/users";
import type { AppRole, ResourceName } from "@/types/models";

export const resourceServices = {
  users: usersService,
  locations: locationsService,
  events: eventsService,
  shifts: shiftsService,
  assignments: assignmentsService,
} as const;

export const resourcePolicies: Record<ResourceName, { read: AppRole[]; write: AppRole[] }> = {
  users: {
    read: ["admin", "superadmin"],
    write: ["admin", "superadmin"],
  },
  locations: {
    read: ["brigadnik", "manager", "admin", "superadmin"],
    write: ["admin", "superadmin"],
  },
  events: {
    read: ["brigadnik", "manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  shifts: {
    read: ["brigadnik", "manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  assignments: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
};
