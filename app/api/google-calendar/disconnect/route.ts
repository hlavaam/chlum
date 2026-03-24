import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { calendarConnectionsService } from "@/lib/services/calendar-connections";
import { calendarSyncsService } from "@/lib/services/calendar-syncs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await calendarConnectionsService.findGoogleByUser(user.id);
  if (connection) {
    await calendarConnectionsService.delete(connection.id);
  }
  const syncRows = await calendarSyncsService.forUser(user.id);
  for (const row of syncRows) {
    await calendarSyncsService.delete(row.id);
  }

  return NextResponse.json({ ok: true });
}
