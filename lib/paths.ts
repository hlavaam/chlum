export const workPaths = {
  root: "/work",
  login: "/work",
  employees: "/work/employees",
  employeesMy: "/work/employees/my",
  base: "/work/zakladna",
  baseWithParams: (params: { date?: string; range?: "week" | "month"; tab?: "attendance" | "reservations" } = {}) => {
    const search = new URLSearchParams();
    if (params.range) search.set("range", params.range);
    if (params.date) search.set("date", params.date);
    if (params.tab) search.set("tab", params.tab);
    const query = search.toString();
    return query ? `/work/zakladna?${query}` : "/work/zakladna";
  },
  profile: "/work/profile",
  employeeDay: (date: string, shiftId?: string) => {
    const search = new URLSearchParams();
    if (shiftId) search.set("shiftId", shiftId);
    const query = search.toString();
    return query ? `/work/employees/day/${date}?${query}` : `/work/employees/day/${date}`;
  },
  schedule: "/work/schedule",
  reservations: "/work/reservations",
  reservationsQuick: "/work/reservations/quick",
  reservationsKiosk: "/work/reservations/kiosk",
  scheduleWithParams: (params: { date?: string; tab?: "calendar" | "admin" | "reservations" } = {}) => {
    const search = new URLSearchParams();
    if (params.tab) search.set("tab", params.tab);
    if (params.date) search.set("date", params.date);
    const query = search.toString();
    return query ? `/work/schedule?${query}` : "/work/schedule";
  },
  events: "/work/events",
  people: "/work/people",
  approvals: "/work/approvals",
  join: (token: string) => `/work/join/${token}`,
} as const;

export const adminPaths = {
  root: "/admin",
  login: "/admin",
  adminSchedule: "/admin/schedule",
  adminScheduleWithParams: (params: { date?: string; tab?: "calendar" | "admin" | "reservations" } = {}) => {
    const search = new URLSearchParams();
    if (params.tab) search.set("tab", params.tab);
    if (params.date) search.set("date", params.date);
    const query = search.toString();
    return query ? `/admin/schedule?${query}` : "/admin/schedule";
  },
  adminEvents: "/admin/events",
  adminPeople: "/admin/people",
  adminMenu: "/admin/menu",
  adminWeb: "/admin/web",
} as const;

export const staffPaths = {
  ...workPaths,
  adminSchedule: workPaths.schedule,
  adminScheduleWithParams: workPaths.scheduleWithParams,
  adminEvents: workPaths.events,
  adminPeople: workPaths.people,
  adminMenu: adminPaths.adminMenu,
  adminWeb: adminPaths.adminWeb,
} as const;
