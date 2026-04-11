import { assignmentsService } from "@/lib/services/assignments";
import { baseAttendanceService } from "@/lib/services/base-attendance";
import { baseReservationsService } from "@/lib/services/base-reservations";
import { calendarConnectionsService } from "@/lib/services/calendar-connections";
import { calendarSyncsService } from "@/lib/services/calendar-syncs";
import { eventsService } from "@/lib/services/events";
import { homepageSectionsService } from "@/lib/services/homepage-sections";
import { invitesService } from "@/lib/services/invites";
import { locationsService } from "@/lib/services/locations";
import { siteSettingsService } from "@/lib/services/site-settings";
import { shiftPresetsService } from "@/lib/services/shift-presets";
import { shiftsService } from "@/lib/services/shifts";
import { telegramReservationSessionsService } from "@/lib/services/telegram-reservation-sessions";
import { usersService } from "@/lib/services/users";
import type { AppRole, ResourceName } from "@/types/models";

export const resourceServices = {
  users: usersService,
  locations: locationsService,
  events: eventsService,
  shifts: shiftsService,
  shift_presets: shiftPresetsService,
  assignments: assignmentsService,
  base_attendance: baseAttendanceService,
  base_reservations: baseReservationsService,
  telegram_reservation_sessions: telegramReservationSessionsService,
  invites: invitesService,
  calendar_connections: calendarConnectionsService,
  calendar_syncs: calendarSyncsService,
  homepage_sections: homepageSectionsService,
  site_settings: siteSettingsService,
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
  base_attendance: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  base_reservations: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  telegram_reservation_sessions: {
    read: ["admin", "superadmin"],
    write: ["admin", "superadmin"],
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
  homepage_sections: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
  site_settings: {
    read: ["manager", "admin", "superadmin"],
    write: ["manager", "admin", "superadmin"],
  },
};
