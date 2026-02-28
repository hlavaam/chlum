import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FlexibleEndTimeFields } from "@/components/flexible-end-time-fields";
import { createEventAction, deleteEventAction } from "@/lib/actions";
import { requireRoles } from "@/lib/auth/rbac";
import { eventTypeLabels } from "@/lib/constants";
import { eventsService } from "@/lib/services/events";
import { locationsService } from "@/lib/services/locations";

export default async function AdminEventsPage() {
  await requireRoles(["manager", "admin"]);
  const [locations, events] = await Promise.all([locationsService.loadAll(), eventsService.loadAll()]);
  const locationMap = new Map(locations.map((l) => [l.id, l]));

  return (
    <div className="stack gap-lg">
      <section className="panel stack">
        <h2>Nový event / svatba</h2>
        <form action={createEventAction} className="grid-form">
          <label>
            Název
            <input type="text" name="name" placeholder="Svatba Novákovi" required />
          </label>
          <label>
            Typ
            <select name="type" defaultValue="wedding">
              <option value="wedding">Svatba</option>
              <option value="event">Event</option>
            </select>
          </label>
          <label>
            Datum
            <input type="date" name="date" required />
          </label>
          <label>
            Čas (hlavně pro svatbu/event)
            <input type="time" name="startTime" defaultValue="12:00" />
          </label>
          <FlexibleEndTimeFields timeLabel="Do (volitelné)" defaultTime="23:00" />
          <label>
            Pobočka
            <select name="locationId" required>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Min. lidí
            <input type="number" min={0} name="minimumPeople" defaultValue={6} required />
          </label>
          <label className="full">
            Poznámky
            <textarea name="notes" rows={3} />
          </label>
          <button type="submit" className="button">
            Vytvořit event (a automaticky směnu)
          </button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Seznam eventů</h2>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Název</th>
                <th>Typ</th>
                <th>Pobočka</th>
                <th>Čas</th>
                <th>Min</th>
                <th>Poznámka</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              {events
                .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
                .map((event) => (
                  <tr key={event.id}>
                    <td data-label="Datum">{event.date}</td>
                    <td data-label="Název">{event.name}</td>
                    <td data-label="Typ">{eventTypeLabels[event.type]}</td>
                    <td data-label="Pobočka">{locationMap.get(event.locationId)?.name}</td>
                    <td data-label="Čas">
                      {event.startTime}–{event.endTime}
                    </td>
                    <td data-label="Min">{event.minimumPeople}</td>
                    <td data-label="Poznámka">{event.notes ?? ""}</td>
                    <td data-label="Akce">
                      <form action={deleteEventAction} className="row wrap admin-inline-form">
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="date" value={event.date} />
                        <input type="hidden" name="redirectTo" value="/admin/events" />
                        <ConfirmSubmitButton
                          type="submit"
                          className="button ghost danger small"
                          confirmMessage="Smazat event a navázanou směnu?"
                        >
                          Smazat
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
