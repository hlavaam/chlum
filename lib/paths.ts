export const staffPaths = {
  root: "/brigadnici",
  login: "/brigadnici/login",
  employees: "/brigadnici/employees",
  employeesMy: "/brigadnici/employees/my",
  employeeDay: (date: string) => `/brigadnici/employees/day/${date}`,
  adminSchedule: "/brigadnici/admin/schedule",
  adminScheduleWithParams: (params: { date?: string; tab?: "calendar" | "admin" } = {}) => {
    const search = new URLSearchParams();
    if (params.tab) search.set("tab", params.tab);
    if (params.date) search.set("date", params.date);
    const query = search.toString();
    return query ? `/brigadnici/admin/schedule?${query}` : "/brigadnici/admin/schedule";
  },
  adminEvents: "/brigadnici/admin/events",
  adminPeople: "/brigadnici/admin/people",
  adminMenu: "/brigadnici/admin/menu",
} as const;
