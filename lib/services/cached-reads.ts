import { cache } from "react";

import { cachedServiceCall } from "@/lib/cache";
import { eventsService } from "@/lib/services/events";
import { invitesService } from "@/lib/services/invites";
import { locationsService } from "@/lib/services/locations";
import { scheduleService } from "@/lib/services/schedule";
import { shiftPresetsService } from "@/lib/services/shift-presets";
import { usersService } from "@/lib/services/users";

export const getUsersCached = cachedServiceCall(
  async () => usersService.loadAll(),
  {
    keyPrefix: "users.all",
    revalidate: 120,
    tags: ["users"],
  },
);

export const getLocationsCached = cachedServiceCall(
  async () => locationsService.loadAll(),
  {
    keyPrefix: "locations.all",
    revalidate: 300,
    tags: ["locations"],
  },
);

export const getDashboardSnapshotCached = cachedServiceCall(
  async (startDate: string, endDate: string) => {
    const { summaryMap, locations, events } = await scheduleService.dashboardContext({ startDate, endDate });
    return {
      summaryEntries: [...summaryMap.entries()],
      locations,
      events,
    };
  },
  {
    keyPrefix: "schedule.dashboard",
    revalidate: 30,
    keyParts: [
      (startDate: string) => startDate,
      (_startDate: string, endDate: string) => endDate,
    ],
    tags: ["shifts", "assignments", "events", "locations"],
  },
);

export const getDayDetailsCached = cachedServiceCall(
  async (date: string) => scheduleService.getDayDetails(date),
  {
    keyPrefix: "schedule.day_details",
    revalidate: 20,
    keyParts: [(date: string) => date],
    tags: ["shifts", "assignments", "users"],
  },
);

export const getWeekRosterCached = cachedServiceCall(
  async (startDate: string, endDate: string) => scheduleService.getWeekRoster(startDate, endDate),
  {
    keyPrefix: "schedule.week_roster",
    revalidate: 20,
    keyParts: [
      (startDate: string) => startDate,
      (_startDate: string, endDate: string) => endDate,
    ],
    tags: ["shifts", "assignments", "users", "locations"],
  },
);

export const getEventsCached = cachedServiceCall(
  async () => eventsService.loadAll(),
  {
    keyPrefix: "events.all",
    revalidate: 60,
    tags: ["events"],
  },
);

export const getInvitesCached = cachedServiceCall(
  async () => invitesService.loadAll(),
  {
    keyPrefix: "invites.all",
    revalidate: 30,
    tags: ["invites"],
  },
);

export const getShiftPresetsCached = cachedServiceCall(
  async () => shiftPresetsService.loadAll(),
  {
    keyPrefix: "shift_presets.all",
    revalidate: 30,
    tags: ["shift_presets"],
  },
);

export const getEventsForDateCached = cachedServiceCall(
  async (date: string) => eventsService.forDate(date),
  {
    keyPrefix: "events.by_date",
    revalidate: 30,
    keyParts: [(date: string) => date],
    tags: ["events"],
  },
);

export const getCurrentUserDashboardSnapshot = cache(
  async (startDate: string, endDate: string) => getDashboardSnapshotCached(startDate, endDate),
);
