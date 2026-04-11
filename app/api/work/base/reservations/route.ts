import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { canUseBaseTerminalRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { workPaths } from "@/lib/paths";
import { createBaseReservationForActor } from "@/lib/services/base-reservation-intake";

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

export async function POST(request: Request) {
  const formRequest = isFormRequest(request);
  const user = await getCurrentUser();
  if (!user || !canUseBaseTerminalRole(user.role)) {
    if (formRequest) {
      const formData = await request.formData();
      const redirectTo = getString(formData, "redirectTo") || workPaths.base;
      return NextResponse.redirect(new URL(appendMessage(redirectTo, "reservationError", "Unauthorized"), request.url));
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let redirectTo: string = workPaths.base;
  let date = "";
  let time = "";
  let partySize = 0;
  let locationId = "";
  let name = "";
  let notes = "";

  if (formRequest) {
    const formData = await request.formData();
    redirectTo = getString(formData, "redirectTo") || workPaths.base;
    date = getString(formData, "date");
    time = getString(formData, "time");
    partySize = Number(getString(formData, "partySize"));
    locationId = getString(formData, "locationId");
    name = getString(formData, "name");
    notes = getString(formData, "notes");
  } else {
    const body = await request.json().catch(() => null);
    date = typeof body?.date === "string" ? body.date.trim() : "";
    time = typeof body?.time === "string" ? body.time.trim() : "";
    partySize = Number(body?.partySize);
    locationId = typeof body?.locationId === "string" ? body.locationId.trim() : "";
    name = typeof body?.name === "string" ? body.name.trim() : "";
    notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  }

  const result = await createBaseReservationForActor(user, {
    date,
    time,
    partySize,
    locationId,
    name,
    notes,
  });

  if (!result.ok) {
    if (formRequest) {
      return NextResponse.redirect(new URL(appendMessage(redirectTo, "reservationError", result.error), request.url));
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  console.info("[base-reservations] Reservation created.", {
    reservationId: result.reservation.id,
    userId: user.id,
    date,
    time,
    locationId,
    partySize,
  });

  revalidatePath(workPaths.base);
  revalidatePath(workPaths.employees);
  revalidatePath(workPaths.schedule);
  revalidatePath(workPaths.reservations);
  revalidatePath(workPaths.reservationsQuick);
  revalidatePath(workPaths.reservationsKiosk);
  revalidatePath(`/work/employees/day/${date}`);

  if (formRequest) {
    return NextResponse.redirect(new URL(appendMessage(redirectTo, "reservationMessage", `Rezervace pro ${date} byla ulozena.`), request.url));
  }

  return NextResponse.json({ ok: true, reservation: result.reservation });
}
