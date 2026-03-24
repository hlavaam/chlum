import { assignmentsService } from "@/lib/services/assignments";
import { calendarConnectionsService } from "@/lib/services/calendar-connections";
import { calendarSyncsService } from "@/lib/services/calendar-syncs";
import { eventsService } from "@/lib/services/events";
import { invitesService } from "@/lib/services/invites";
import { locationsService } from "@/lib/services/locations";
import { shiftPresetsService } from "@/lib/services/shift-presets";
import { shiftsService } from "@/lib/services/shifts";
import { usersService } from "@/lib/services/users";
import type { AppRole, ResourceName } from "@/types/models";

export const resourceServices = {
  users: usersService,
  locations: locationsService,
  events: eventsService,
  shifts: shiftsService,
  shift_presets: shiftPresetsService,
  assignments: assignmentsService,
  invites: invitesService,
  calendar_connections: calendarConnectionsService,
  calendar_syncs: calendarSyncsService,
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
  shift_presets: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  assignments: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  invites: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  calendar_connections: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  calendar_syncs: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
};
