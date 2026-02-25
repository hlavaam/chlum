import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { shiftsService } from "@/lib/services/shifts";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "brigadnik") {
    return NextResponse.json({ error: "Only brigadnik can sign up" }, { status: 403 });
  }
  const { id } = await context.params;
  await request.json().catch(() => ({}));
  const assignment = await shiftsService
    .signup(id, user, user.preferredRoles[0] ?? "service")
    .catch((error: Error) => error);
  if (assignment instanceof Error) {
    return NextResponse.json({ error: assignment.message }, { status: 400 });
  }
  return NextResponse.json({ data: assignment }, { status: 201 });
}
