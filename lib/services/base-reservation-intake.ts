import { canUseBaseTerminalRole, isBaseRole } from "@/lib/auth/role-access";
import { filterBaseLocations } from "@/lib/services/base-locations";
import { locationsService } from "@/lib/services/locations";
import { baseReservationsService } from "@/lib/services/base-reservations";
import type { BaseReservationRecord, UserRecord } from "@/types/models";

export type BaseReservationInput = {
  date: string;
  time: string;
  partySize: number;
  locationId: string;
  name?: string;
  notes?: string;
};

type ReservationResult =
  | {
      ok: true;
      reservation: BaseReservationRecord;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

type DeleteReservationResult =
  | {
      ok: true;
      reservation: BaseReservationRecord;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export async function getAllowedBaseLocationIdsForActor(actor: UserRecord) {
  const baseLocations = filterBaseLocations(await locationsService.loadAll());
  return new Set(
    (
      isBaseRole(actor.role)
        ? actor.locationIds.length === 0
          ? baseLocations
          : baseLocations.filter((location) => actor.locationIds.includes(location.id))
        : baseLocations
    ).map((location) => location.id),
  );
}

export async function createBaseReservationForActor(actor: UserRecord | null, input: BaseReservationInput): Promise<ReservationResult> {
  if (!actor || !canUseBaseTerminalRole(actor.role)) {
    return {
      ok: false,
      error: "Unauthorized",
      status: 401,
    };
  }

  if (!isValidDate(input.date) || !isValidTime(input.time) || !Number.isInteger(input.partySize) || input.partySize < 1 || !input.locationId) {
    return {
      ok: false,
      error: "Neplatna rezervace.",
      status: 400,
    };
  }

  const allowedLocationIds = await getAllowedBaseLocationIdsForActor(actor);

  if (!allowedLocationIds.has(input.locationId)) {
    return {
      ok: false,
      error: "Neplatna pobocka.",
      status: 403,
    };
  }

  const reservation = await baseReservationsService.create({
    date: input.date,
    time: input.time,
    partySize: input.partySize,
    locationId: input.locationId,
    name: input.name || undefined,
    notes: input.notes || undefined,
    createdByUserId: actor.id,
  });

  return {
    ok: true,
    reservation,
  };
}

export async function deleteBaseReservationForActor(
  actor: UserRecord | null,
  reservationId: string,
): Promise<DeleteReservationResult> {
  if (!actor || !canUseBaseTerminalRole(actor.role)) {
    return {
      ok: false,
      error: "Unauthorized",
      status: 401,
    };
  }

  if (!reservationId) {
    return {
      ok: false,
      error: "Chybi rezervace.",
      status: 400,
    };
  }

  const reservation = await baseReservationsService.findById(reservationId);
  if (!reservation) {
    return {
      ok: false,
      error: "Rezervace nebyla nalezena.",
      status: 404,
    };
  }

  const allowedLocationIds = await getAllowedBaseLocationIdsForActor(actor);
  if (!allowedLocationIds.has(reservation.locationId)) {
    return {
      ok: false,
      error: "Neplatna pobocka.",
      status: 403,
    };
  }

  await baseReservationsService.delete(reservation.id);

  return {
    ok: true,
    reservation,
  };
}
