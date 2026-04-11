import { AppLink } from "@/components/app-link";
import { workPaths } from "@/lib/paths";
import { addDays, formatCzDate, toDateKey } from "@/lib/utils";

type LocationOption = {
  id: string;
  name: string;
  code: string;
};

type Props = {
  locations: LocationOption[];
  reservationMessage?: string | null;
  reservationError?: string | null;
  kiosk?: boolean;
};

export function QuickReservationForm({
  locations,
  reservationMessage = null,
  reservationError = null,
  kiosk = false,
}: Props) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(addDays(today, 1));
  const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
  const redirectTo = kiosk ? workPaths.reservationsKiosk : workPaths.reservationsQuick;

  return (
    <div className={`quick-reservation-shell stack gap-lg ${kiosk ? "quick-reservation-shell-kiosk" : ""}`.trim()}>
      <section className="panel stack gap-lg quick-reservation-hero">
        <div className="row between wrap align-center">
          <div>
            <p className="eyebrow">Rychlá rezervace</p>
            <h1>{kiosk ? "Kiosek pro zápis rezervací" : "Zapsat rezervaci za pár vteřin"}</h1>
            {kiosk ? <p className="tiny subtle">Verze {buildVersion}</p> : null}
          </div>
          <div className="row gap-sm wrap">
            {!kiosk ? (
              <>
                <AppLink className="button ghost" href={workPaths.reservationsKiosk}>
                  Kiosk verze
                </AppLink>
                <AppLink className="button ghost" href={workPaths.reservations}>
                  Otevřít kalendář
                </AppLink>
              </>
            ) : null}
          </div>
        </div>
        <p className="subtle">
          {kiosk
            ? "Velký jednoduchý zapisovač rezervací bez zbytku appky kolem. Hodí se na tablet nebo jako pinned shortcut."
            : "Tohle je jednoduchý mobilní formulář místo chatu. Hodí se jako shortcut na ploše a zapisuje rezervaci rovnou do systému."}
        </p>
        <div className="row gap-sm wrap">
          <span className="badge neutral">Dnes: {formatCzDate(todayKey)}</span>
          <span className="badge neutral">Zítra: {formatCzDate(tomorrowKey)}</span>
        </div>
      </section>

      {reservationMessage ? <p className="badge success">{reservationMessage}</p> : null}
      {reservationError ? <p className="alert">{reservationError}</p> : null}

      <section className="panel quick-reservation-chat">
        {locations.length === 0 ? <p className="alert">Nejsou dostupné žádné pobočky pro rezervace.</p> : null}
        {locations.length > 0 ? (
          <>
            <div className="chat-bubble chat-bubble-system">
              <p>Která pobočka?</p>
            </div>
            <form className="stack gap-lg" action="/api/work/base/reservations" method="post">
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <label className="quick-reservation-field">
                <span className="quick-reservation-label">Pobočka</span>
                <select name="locationId" defaultValue={locations[0]?.id ?? ""} required>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} • {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="chat-bubble chat-bubble-system">
                <p>Na kdy a v kolik?</p>
              </div>

              <div className="quick-reservation-grid">
                <label className="quick-reservation-field">
                  <span className="quick-reservation-label">Datum</span>
                  <input type="date" name="date" defaultValue={todayKey} required />
                </label>
                <label className="quick-reservation-field">
                  <span className="quick-reservation-label">Čas</span>
                  <input type="time" name="time" defaultValue="18:00" required />
                </label>
              </div>

              <div className="chat-bubble chat-bubble-system">
                <p>Pro kolik lidí?</p>
              </div>

              <label className="quick-reservation-field">
                <span className="quick-reservation-label">Počet osob</span>
                <input type="number" name="partySize" min={1} max={40} defaultValue={2} required />
              </label>

              <div className="chat-bubble chat-bubble-system">
                <p>Kdo to je a chceš k tomu něco dopsat?</p>
              </div>

              <div className="quick-reservation-grid">
                <label className="quick-reservation-field">
                  <span className="quick-reservation-label">Jméno</span>
                  <input type="text" name="name" placeholder="Nepovinné" />
                </label>
                <label className="quick-reservation-field">
                  <span className="quick-reservation-label">Poznámka</span>
                  <textarea name="notes" rows={4} placeholder="Nepovinné" />
                </label>
              </div>

              <div className="quick-reservation-actions">
                <button type="submit" className="button quick-reservation-submit">
                  Uložit rezervaci
                </button>
                <p className="subtle tiny">
                  {kiosk
                    ? "Tuhle adresu si dej jako shortcut a otevře se ti rovnou jen zapisovač."
                    : "Tip: tuhle stránku si dej jako záložku nebo shortcut a máš z ní rychlý interní zapisovač."}
                </p>
              </div>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
