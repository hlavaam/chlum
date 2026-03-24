import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { canUseWorkRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { upsertGoogleCalendarEventForAssignment } from "@/lib/services/google-calendar-sync";
import { shiftsService } from "@/lib/services/shifts";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseWorkRole(user.role)) {
    return NextResponse.json({ error: "Only work users can sign up" }, { status: 403 });
  }
  const { id } = await context.params;
  await request.json().catch(() => ({}));
  const assignment = await shiftsService
    .signup(id, user, user.preferredRoles[0] ?? "plac")
    .catch((error: Error) => error);
  if (assignment instanceof Error) {
    return NextResponse.json({ error: assignment.message }, { status: 400 });
  }
  if (assignment.status === "confirmed") {
    await upsertGoogleCalendarEventForAssignment(user.id, id).catch(() => null);
  }
  revalidateTag("assignments");
  revalidateTag("shifts");
  revalidateTag("calendar_syncs");
  return NextResponse.json({ data: assignment }, { status: 201 });
}
