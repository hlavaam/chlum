import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { canUseBaseTerminalRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { workPaths } from "@/lib/paths";
import { deleteBaseReservationForActor } from "@/lib/services/base-reservation-intake";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isFormRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
}

function appendMessage(target: string, key: string, value: string) {
  const url = new URL(target || workPaths.reservations, "https://vysker.local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

export async function POST(request: Request) {
  const formRequest = isFormRequest(request);
  const user = await getCurrentUser();
  let redirectTo: string = workPaths.reservations;
  let reservationId = "";

  if (formRequest) {
    const formData = await request.formData();
    redirectTo = getString(formData, "redirectTo") || workPaths.reservations;
    reservationId = getString(formData, "reservationId");
  } else {
    const body = await request.json().catch(() => null);
    redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo.trim() : workPaths.reservations;
    reservationId = typeof body?.reservationId === "string" ? body.reservationId.trim() : "";
  }

  if (!user || !canUseBaseTerminalRole(user.role)) {
    if (formRequest) {
      return NextResponse.redirect(new URL(appendMessage(redirectTo, "reservationError", "Unauthorized"), request.url));
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!reservationId) {
    if (formRequest) {
      return NextResponse.redirect(new URL(appendMessage(redirectTo, "reservationError", "Chybi rezervace."), request.url));
    }
    return NextResponse.json({ error: "Missing reservation id" }, { status: 400 });
  }

  const result = await deleteBaseReservationForActor(user, reservationId);
  if (!result.ok) {
    if (formRequest) {
      return NextResponse.redirect(new URL(appendMessage(redirectTo, "reservationError", result.error), request.url));
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const reservation = result.reservation;

  revalidatePath(workPaths.base);
  revalidatePath(workPaths.employees);
  revalidatePath(workPaths.schedule);
  revalidatePath(workPaths.reservations);
  revalidatePath(workPaths.reservationsQuick);
  revalidatePath(workPaths.reservationsKiosk);
  revalidatePath(`/work/employees/day/${reservation.date}`);

  if (formRequest) {
    return NextResponse.redirect(new URL(appendMessage(redirectTo, "reservationMessage", `Rezervace pro ${reservation.date} byla smazana.`), request.url));
  }

  return NextResponse.json({ ok: true });
}
