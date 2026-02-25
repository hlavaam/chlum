import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { csvEscape } from "@/lib/utils";
import { assignmentsService } from "@/lib/services/assignments";
import { locationsService } from "@/lib/services/locations";
import { shiftsService } from "@/lib/services/shifts";
import { usersService } from "@/lib/services/users";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["manager", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [shifts, assignments, users, locations] = await Promise.all([
    shiftsService.loadAll(),
    assignmentsService.loadAll(),
    usersService.loadAll(),
    locationsService.loadAll(),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const assignmentsByShift = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const list = assignmentsByShift.get(assignment.shiftId) ?? [];
    list.push(assignment);
    assignmentsByShift.set(assignment.shiftId, list);
  }

  const header = [
    "date",
    "startTime",
    "endTime",
    "location",
    "type",
    "minimumPeople",
    "requiresApproval",
    "occupancyConfirmed",
    "occupancyPending",
    "assignedPeople",
  ];

  const rows = shifts
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
    .map((shift) => {
      const list = assignmentsByShift.get(shift.id) ?? [];
      const confirmed = list.filter((a) => a.status === "confirmed").length;
      const pending = list.filter((a) => a.status === "pending").length;
      const assignedPeople = list
        .map((a) => `${userMap.get(a.userId)?.name ?? a.userId} (${a.staffRole}/${a.status})`)
        .join("; ");
      return [
        shift.date,
        shift.startTime,
        shift.endTime,
        locationMap.get(shift.locationId)?.name ?? shift.locationId,
        shift.type,
        shift.minimumPeople,
        shift.requiresApproval ? "yes" : "no",
        confirmed,
        pending,
        assignedPeople,
      ];
    });

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="shifts-export.csv"',
    },
  });
}
