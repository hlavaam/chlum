import { NextResponse } from "next/server";

import { dailyMenuService } from "@/lib/services/daily-menu";

export async function GET() {
  const dates = await dailyMenuService.listDates();
  return NextResponse.json({ dates });
}
