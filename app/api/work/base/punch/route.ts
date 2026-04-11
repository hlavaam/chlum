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

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isFormRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
}

function appendMessage(target: string, key: string, value: string) {
  const url = new URL(target || workPaths.base, "https://vysker.local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function appendPunchContext(target: string, body: PunchBody) {
  const url = new URL(target || workPaths.base, "https://vysker.local");
  url.searchParams.set("locationId", body.locationId);
  if (body.mode === "pin") {
    url.searchParams.set("userId", body.userId);
  }
  return `${url.pathname}${url.search}`;
}

function appendLocationOnly(target: string, body: PunchBody) {
  const url = new URL(target || workPaths.base, "https://vysker.local");
  url.searchParams.set("locationId", body.locationId);
  url.searchParams.delete("userId");
  url.searchParams.delete("pin");
  return `${url.pathname}${url.search}`;
}

function appendPinContext(target: string, locationId: string, userId: string, pin: string) {
  const url = new URL(target || workPaths.base, "https://vysker.local");
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("userId", userId);
  if (pin) {
    url.searchParams.set("pin", pin);
  } else {
    url.searchParams.delete("pin");
  }
  return `${url.pathname}${url.search}`;
}

export async function POST(request: Request) {
  const formRequest = isFormRequest(request);
  let body: PunchBody;
  let redirectTo: string = workPaths.base;

  if (formRequest) {
    const formData = await request.formData();
    const mode = getString(formData, "mode");
    redirectTo = getString(formData, "redirectTo") || workPaths.base;
    const keypadDigit = getString(formData, "keypadDigit").replace(/\D/g, "").slice(0, 1);
    const keypadAction = getString(formData, "keypadAction");
    const currentPin = getString(formData, "pin").replace(/\D/g, "").slice(0, 4);
    const locationId = getString(formData, "locationId");
    const userId = getString(formData, "userId");

    if (mode === "pin" && (keypadDigit || keypadAction)) {
      const nextPin =
        keypadAction === "clear"
          ? ""
          : keypadAction === "backspace"
            ? currentPin.slice(0, -1)
            : `${currentPin}${keypadDigit}`.slice(0, 4);

      if (nextPin.length < 4) {
        return NextResponse.redirect(new URL(appendPinContext(redirectTo, locationId, userId, nextPin), request.url));
      }

      body = {
        mode,
        locationId,
        userId,
        pin: nextPin,
      };
    } else if (mode === "pin") {
      body = {
        mode,
        locationId,
        userId,
        pin: currentPin,
      };
    } else if (mode === "self") {
      body = {
        mode,
        locationId,
      };
    } else {
      body = {
        mode: "qr",
        locationId,
        qrToken: getString(formData, "qrToken"),
      };
    }
  } else {
    body = (await request.json()) as PunchBody;
  }
  const currentUser = await getCurrentUser();

  if (!currentUser || !canUseBaseTerminalRole(currentUser.role)) {
    if (formRequest) {
      return NextResponse.redirect(
        new URL(appendMessage(appendPunchContext(redirectTo, body), "terminalError", "Základna vyžaduje přihlášený účet."), request.url),
      );
    }
    return NextResponse.json({ error: "Základna vyžaduje přihlášený účet." }, { status: 401 });
  }

  if (!body?.locationId) {
    if (formRequest) {
      return NextResponse.redirect(new URL(appendMessage(redirectTo, "terminalError", "Chybí vybraná základna."), request.url));
    }
    return NextResponse.json({ error: "Chybí vybraná základna." }, { status: 400 });
  }

  const user = await resolveTargetUser(body);
  if (!user) {
    if (formRequest) {
      return NextResponse.redirect(
        new URL(appendMessage(appendPunchContext(redirectTo, body), "terminalError", "Nepodařilo se ověřit uživatele."), request.url),
      );
    }
    return NextResponse.json({ error: "Nepodařilo se ověřit uživatele." }, { status: 401 });
  }
  if (user.role === "base") {
    if (formRequest) {
      return NextResponse.redirect(
        new URL(
          appendMessage(appendPunchContext(redirectTo, body), "terminalError", "Kioskový účet Základna se přes píchačku neeviduje."),
          request.url,
        ),
      );
    }
    return NextResponse.json({ error: "Kioskový účet Základna se přes píchačku neeviduje." }, { status: 400 });
  }

  const activeRecord = await baseAttendanceService.activeForUser(user.id);
  if (activeRecord && activeRecord.clockInLocationId !== body.locationId) {
    const errorMessage = "Tenhle člověk je právě píchnutý na jiné pobočce. Přepni se tam a odchod zapiš tam.";
    if (formRequest) {
      return NextResponse.redirect(new URL(appendMessage(appendPunchContext(redirectTo, body), "terminalError", errorMessage), request.url));
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 409 },
    );
  }

  if (isBaseRole(currentUser.role)) {
    const hasLocationAccess =
      currentUser.locationIds.length === 0 || currentUser.locationIds.includes(body.locationId);
    if (!hasLocationAccess) {
      if (formRequest) {
        return NextResponse.redirect(
          new URL(
            appendMessage(appendPunchContext(redirectTo, body), "terminalError", "Tenhle účet Základna nemá přístup k vybrané pobočce."),
            request.url,
          ),
        );
      }
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

  if (formRequest) {
    const action = record?.clockOutAt ? "Odchod" : "Příchod";
    return NextResponse.redirect(
      new URL(appendMessage(appendLocationOnly(redirectTo, body), "terminalMessage", `${user.name}: ${action} zapsán.`), request.url),
    );
  }

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
