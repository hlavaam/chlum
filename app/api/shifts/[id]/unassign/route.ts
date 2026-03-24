import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { canUseWorkRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteGoogleCalendarEventForAssignment } from "@/lib/services/google-calendar-sync";
import { shiftsService } from "@/lib/services/shifts";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseWorkRole(user.role)) {
    return NextResponse.json({ error: "Only work users can unassign" }, { status: 403 });
  }
  const { id } = await context.params;
  const ok = await shiftsService.unassign(id, user.id);
  if (ok) {
    await deleteGoogleCalendarEventForAssignment(user.id, id).catch(() => null);
  }
  revalidateTag("assignments");
  revalidateTag("shifts");
  revalidateTag("calendar_syncs");
  return NextResponse.json({ ok });
}
