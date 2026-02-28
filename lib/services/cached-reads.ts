import { cache } from "react";

import { cachedServiceCall } from "@/lib/cache";
import { eventsService } from "@/lib/services/events";
import { locationsService } from "@/lib/services/locations";
import { scheduleService } from "@/lib/services/schedule";
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

export const getEventsCached = cachedServiceCall(
  async () => eventsService.loadAll(),
  {
    keyPrefix: "events.all",
    revalidate: 60,
    tags: ["events"],
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
