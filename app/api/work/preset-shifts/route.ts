import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { isManagerRole } from "@/lib/auth/role-access";
import { upsertShiftForDate } from "@/lib/services/shift-upserts";
import { shiftPresetsService } from "@/lib/services/shift-presets";

type Payload = {
  date?: string;
  presetId?: string;
  requiresApproval?: boolean;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Payload;
  const preset = body.presetId ? await shiftPresetsService.findById(body.presetId) : null;
  if (!preset || !body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "Invalid preset payload" }, { status: 400 });
  }

  const shift = await upsertShiftForDate({
    date: body.date,
    locationId: preset.locationId,
    type: preset.type,
    startTime: preset.startTime,
    endTime: preset.endTime,
    minimumPeople: preset.requiredRoles.reduce((total, item) => total + item.count, 0),
    requiredRoles: preset.requiredRoles,
    requiresApproval: Boolean(body.requiresApproval),
    notes: preset.notes,
  });
  revalidateTag("shifts");
  revalidateTag("assignments");

  return NextResponse.json({ data: shift }, { status: 201 });
}
