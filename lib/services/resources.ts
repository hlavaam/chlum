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
    read: ["admin"],
    write: ["admin"],
  },
  locations: {
    read: ["brigadnik", "manager", "admin"],
    write: ["admin"],
  },
  events: {
    read: ["brigadnik", "manager", "admin"],
    write: ["manager", "admin"],
  },
  shifts: {
    read: ["brigadnik", "manager", "admin"],
    write: ["manager", "admin"],
  },
  assignments: {
    read: ["manager", "admin"],
    write: ["manager", "admin"],
  },
};
