"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AppLink } from "@/components/app-link";
import { authFetch, parseJsonResponse } from "@/lib/auth/client";

type ReservationItem = {
  id: string;
  time: string;
  partySize: number;
  name?: string;
  notes?: string;
  locationId: string;
  locationLabel: string;
};

type ReservationDay = {
  date: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  reservations: ReservationItem[];
};

type LocationOption = {
  id: string;
  name: string;
  code: string;
};

type CreateResponse = {
  ok?: boolean;
  error?: string;
};

type DeleteResponse = {
  ok?: boolean;
  error?: string;
};

type Props = {
  monthLabel: string;
  previousHref: string;
  nextHref: string;
  days: ReservationDay[];
  locations: LocationOption[];
  defaultLocationId: string;
};

function reservationLabel(item: ReservationItem) {
  return `${item.time} • ${item.partySize} os.`;
}

export function BaseReservationsBoard({ monthLabel, previousHref, nextHref, days, locations, defaultLocationId }: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedDay = days.find((day) => day.date === selectedDate) ?? null;

  async function handleCreateReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDay) return;

    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const time = typeof formData.get("time") === "string" ? String(formData.get("time")) : "";
    const partySize = Number(formData.get("partySize"));
    const locationId = typeof formData.get("locationId") === "string" ? String(formData.get("locationId")) : defaultLocationId;
    const name = typeof formData.get("name") === "string" ? String(formData.get("name")) : "";
    const notes = typeof formData.get("notes") === "string" ? String(formData.get("notes")) : "";

    const response = await authFetch("/api/work/base/reservations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        date: selectedDay.date,
        time,
        partySize,
        locationId,
        name,
        notes,
      }),
    });
    const result = await parseJsonResponse<CreateResponse>(response);

    console.info("[base-reservations] Create request finished.", {
      ok: response.ok,
      status: response.status,
      body: result,
    });

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Rezervaci se nepodařilo uložit.");
      return;
    }

    setMessage(`Rezervace pro ${selectedDay.date} byla uložená.`);
    setPending(false);
    setSelectedDate(null);
    router.refresh();
  }

  async function handleDeleteReservation(reservationId: string) {
    setDeletingId(reservationId);
    setError(null);

    const response = await authFetch("/api/work/base/reservations/delete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reservationId,
      }),
    });
    const result = await parseJsonResponse<DeleteResponse>(response);

    if (!response.ok) {
      setDeletingId(null);
      setError(result?.error ?? "Rezervaci se nepodařilo smazat.");
      return;
    }

    setMessage("Rezervace byla smazaná.");
    setDeletingId(null);
    router.refresh();
  }

  return (
    <>
      <section className="panel stack gap-lg">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Rezervace</p>
            <h2>{monthLabel}</h2>
          </div>
          <div className="row gap-sm wrap">
            <AppLink className="button ghost small" href={previousHref}>
              Predchozi mesic
            </AppLink>
            <AppLink className="button ghost small" href={nextHref}>
              Dalsi mesic
            </AppLink>
          </div>
        </div>
        <p className="subtle">
          Klikni na den v kalendari a otevru se okno pro pridani rezervace. V kazde bunce vidis zapsane casy a pocet osob.
        </p>
        {message ? <p className="badge success">{message}</p> : null}
        <div className="base-reservations-grid">
          {["Po", "Ut", "St", "Ct", "Pa", "So", "Ne"].map((weekday) => (
            <div key={weekday} className="base-calendar-weekday">
              {weekday}
            </div>
          ))}
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              className={`base-calendar-day ${day.inCurrentMonth ? "" : "outside"} ${day.isToday ? "today" : ""}`.trim()}
              onClick={() => {
                setSelectedDate(day.date);
                setError(null);
              }}
            >
              <span className="base-calendar-day-number">{day.dayNumber}.</span>
              <div className="base-calendar-day-list">
                {day.reservations.length === 0 ? <span className="subtle tiny">Bez rezervace</span> : null}
                {day.reservations.slice(0, 3).map((item) => (
                  <span key={item.id} className="base-calendar-chip">
                    {reservationLabel(item)}
                  </span>
                ))}
                {day.reservations.length > 3 ? <span className="tiny subtle">+{day.reservations.length - 3} dalsi</span> : null}
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedDay ? (
        <div className="calendar-overlay" role="dialog" aria-modal="true" aria-label={`Rezervace pro ${selectedDay.date}`}>
          <button
            type="button"
            className="calendar-overlay-backdrop"
            aria-label="Zavrit rezervacni okno"
            onClick={() => setSelectedDate(null)}
          />
          <div className="calendar-overlay-panel">
            <section className="panel stack base-reservation-modal">
              <div className="row between wrap align-start">
                <div>
                  <p className="eyebrow">Rezervace dne</p>
                  <h3>{selectedDay.date}</h3>
                </div>
                <button type="button" className="icon-button modal-close-button" aria-label="Zavrit" onClick={() => setSelectedDate(null)}>
                  <span aria-hidden>x</span>
                </button>
              </div>

              <div className="stack gap-sm">
                <h4>Aktualni rezervace</h4>
                {selectedDay.reservations.length === 0 ? <p className="subtle">Na tenhle den zatim neni zadna rezervace.</p> : null}
                {selectedDay.reservations.length > 0 ? (
                  <div className="stack gap-sm">
                    {selectedDay.reservations.map((item) => (
                      <article key={item.id} className="base-reservation-list-item">
                        <div className="row between wrap gap-sm align-center">
                          <div className="stack gap-sm">
                            <p>
                              <strong>{item.time}</strong> • {item.partySize} osob • {item.locationLabel}
                            </p>
                            <p className="tiny subtle">
                              {item.name ? item.name : "Bez jmena"}
                              {item.notes ? ` • ${item.notes}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="button ghost danger small"
                            disabled={deletingId === item.id}
                            onClick={() => {
                              if (!window.confirm("Smazat tuhle rezervaci?")) return;
                              void handleDeleteReservation(item.id);
                            }}
                          >
                            {deletingId === item.id ? "Mažu..." : "Smazat"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>

              <form key={selectedDay.date} className="stack gap-sm" onSubmit={handleCreateReservation}>
                {locations.length > 1 ? (
                  <label>
                    Pobocka
                    <select name="locationId" defaultValue={defaultLocationId} disabled={pending}>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code} • {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <input type="hidden" name="locationId" value={defaultLocationId} />
                )}
                <label>
                  Cas
                  <input type="time" name="time" defaultValue="18:00" required disabled={pending} />
                </label>
                <label>
                  Pocet osob
                  <input type="number" name="partySize" min={1} max={40} defaultValue={2} required disabled={pending} />
                </label>
                <label>
                  Jmeno
                  <input type="text" name="name" placeholder="Nepovinne" disabled={pending} />
                </label>
                <label>
                  Poznamka
                  <textarea name="notes" rows={3} placeholder="Nepovinne" disabled={pending} />
                </label>
                {error ? <p className="alert">{error}</p> : null}
                <button type="submit" className="button" disabled={pending}>
                  {pending ? "Ukladam..." : "Pridat rezervaci"}
                </button>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
