import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { shiftsService } from "@/lib/services/shifts";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "brigadnik" && user.role !== "admin") {
    return NextResponse.json({ error: "Only brigadnik or admin can unassign" }, { status: 403 });
  }
  const { id } = await context.params;
  const ok = await shiftsService.unassign(id, user.id);
  return NextResponse.json({ ok });
}
