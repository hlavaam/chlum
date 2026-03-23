import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { staffPaths } from "@/lib/paths";
import { dailyMenuService, isValidMenuDate, toMenuDateKey } from "@/lib/services/daily-menu";

function readDate(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || toMenuDateKey(new Date());
  return { url, date };
}

export async function GET(request: Request) {
  const { date } = readDate(request);
  const normalizedDate = isValidMenuDate(date) ? date : toMenuDateKey(new Date());
  const menu = await dailyMenuService.getMenu(normalizedDate);
  return NextResponse.json({ date: normalizedDate, menu });
}

export async function PUT(request: Request) {
  const { date } = readDate(request);
  if (!isValidMenuDate(date)) {
    return NextResponse.json({ error: "Neplatne datum. Pouzijte format YYYY-MM-DD." }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Telo pozadavku musi byt validni JSON." }, { status: 400 });
  }

  try {
    const menu = await dailyMenuService.saveMenu(date, payload);
    revalidatePath("/");
    revalidatePath(staffPaths.adminMenu);
    return NextResponse.json({ ok: true, date, menu });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Menu se nepodarilo ulozit." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const { date } = readDate(request);
  if (!isValidMenuDate(date)) {
    return NextResponse.json({ error: "Neplatne datum. Pouzijte format YYYY-MM-DD." }, { status: 400 });
  }

  try {
    await dailyMenuService.deleteMenu(date);
    revalidatePath("/");
    revalidatePath(staffPaths.adminMenu);
    return NextResponse.json({ ok: true, date });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Menu se nepodarilo smazat." },
      { status: 400 },
    );
  }
}
