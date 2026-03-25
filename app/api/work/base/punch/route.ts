import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { canUseBaseTerminalRole, isBaseRole } from "@/lib/auth/role-access";
import { verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";
import { workPaths } from "@/lib/paths";
import { baseAttendanceService } from "@/lib/services/base-attendance";
import { resolveBaseAttendanceToken } from "@/lib/services/base-attendance-qr";
import { usersService } from "@/lib/services/users";

type PunchBody =
  | {
      mode: "self";
      locationId: string;
    }
  | {
      mode: "pin";
      locationId: string;
      userId: string;
      pin: string;
    }
  | {
      mode: "qr";
      locationId: string;
      qrToken: string;
    };

async function resolveTargetUser(body: PunchBody) {
  if (body.mode === "self") {
    return getCurrentUser();
  }

  if (body.mode === "pin") {
    const user = await usersService.findById(body.userId);
    if (!user || !user.active || !user.pinHash || !verifyPassword(body.pin, user.pinHash)) return null;
    return user;
  }

  const userId = resolveBaseAttendanceToken(body.qrToken);
  if (!userId) return null;
  const user = await usersService.findById(userId);
  return user && user.active ? user : null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as PunchBody;
  const currentUser = await getCurrentUser();

  if (!currentUser || !canUseBaseTerminalRole(currentUser.role)) {
    return NextResponse.json({ error: "Základna vyžaduje přihlášený účet." }, { status: 401 });
  }

  if (!body?.locationId) {
    return NextResponse.json({ error: "Chybí vybraná základna." }, { status: 400 });
  }

  const user = await resolveTargetUser(body);
  if (!user) {
    return NextResponse.json({ error: "Nepodařilo se ověřit uživatele." }, { status: 401 });
  }
  if (user.role === "base") {
    return NextResponse.json({ error: "Kioskový účet Základna se přes píchačku neeviduje." }, { status: 400 });
  }

  const activeRecord = await baseAttendanceService.activeForUser(user.id);
  if (activeRecord && activeRecord.clockInLocationId !== body.locationId) {
    return NextResponse.json(
      { error: "Tenhle člověk je právě píchnutý na jiné pobočce. Přepni se tam a odchod zapiš tam." },
      { status: 409 },
    );
  }

  if (isBaseRole(currentUser.role)) {
    const hasLocationAccess =
      currentUser.locationIds.length === 0 || currentUser.locationIds.includes(body.locationId);
    if (!hasLocationAccess) {
      return NextResponse.json({ error: "Tenhle účet Základna nemá přístup k vybrané pobočce." }, { status: 403 });
    }
  }

  const record = await baseAttendanceService.togglePunch({
    userId: user.id,
    locationId: body.locationId,
    method: body.mode,
  });

  revalidateTag("base_attendance");
  revalidatePath(workPaths.base);
  revalidatePath(workPaths.profile);

  return NextResponse.json({
    ok: true,
    action: record?.clockOutAt ? "clock_out" : "clock_in",
    user: {
      id: user.id,
      name: user.name,
    },
    record,
  });
}
