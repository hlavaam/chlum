export const workPaths = {
  root: "/work",
  login: "/work",
  employees: "/work/employees",
  employeesMy: "/work/employees/my",
  employeeDay: (date: string) => `/work/employees/day/${date}`,
  schedule: "/work/schedule",
  scheduleWithParams: (params: { date?: string; tab?: "calendar" | "admin" } = {}) => {
    const search = new URLSearchParams();
    if (params.tab) search.set("tab", params.tab);
    if (params.date) search.set("date", params.date);
    const query = search.toString();
    return query ? `/work/schedule?${query}` : "/work/schedule";
  },
  events: "/work/events",
  people: "/work/people",
} as const;

export const adminPaths = {
  root: "/admin",
  login: "/admin",
  adminSchedule: "/admin/schedule",
  adminScheduleWithParams: (params: { date?: string; tab?: "calendar" | "admin" } = {}) => {
    const search = new URLSearchParams();
    if (params.tab) search.set("tab", params.tab);
    if (params.date) search.set("date", params.date);
    const query = search.toString();
    return query ? `/admin/schedule?${query}` : "/admin/schedule";
  },
  adminEvents: "/admin/events",
  adminPeople: "/admin/people",
  adminMenu: "/admin/menu",
} as const;

export const staffPaths = {
  ...workPaths,
  adminSchedule: workPaths.schedule,
  adminScheduleWithParams: workPaths.scheduleWithParams,
  adminEvents: workPaths.events,
  adminPeople: workPaths.people,
  adminMenu: adminPaths.adminMenu,
} as const;
