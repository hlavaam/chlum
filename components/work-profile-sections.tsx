import { disconnectGoogleCalendarAction, updateMyAccountAction, updateMyPhotoAction, updateMyPreferencesAction } from "@/lib/actions";
import { AppLink } from "@/components/app-link";
import { createBaseAttendanceQrDataUrl, createBaseAttendanceToken } from "@/lib/services/base-attendance-qr";
import {
  STAFF_ROLES,
  staffRoleLabels,
  WORK_DAY_PREFERENCES,
  workDayPreferenceLabels,
  WORK_PERIODS,
  workPeriodLabels,
} from "@/lib/constants";
import type { CalendarConnectionRecord, UserRecord } from "@/types/models";

type FeedbackState = {
  saved?: string;
  error?: string;
  google?: string;
  welcome?: boolean;
};

type AccountSectionProps = {
  user: UserRecord;
  redirectTo: string;
  feedback?: FeedbackState;
  activeBaseRecord?: {
    clockInAt: string;
    clockInLocationId: string;
  } | null;
};

type PreferencesSectionProps = {
  user: UserRecord;
  redirectTo: string;
  feedback?: FeedbackState;
};

type GoogleSectionProps = {
  user: Pick<UserRecord, "email">;
  redirectTo: string;
  googleConfigured: boolean;
  googleConnection: CalendarConnectionRecord | null;
  googleStatus?: string;
};

type BaseQrSectionProps = {
  user: Pick<UserRecord, "id" | "name">;
};

function accountErrorMessage(error?: string) {
  switch (error) {
    case "account_name":
      return "Jméno nesmí zůstat prázdné.";
    case "account_email":
      return "Vyplň platný e-mail.";
    case "account_exists":
      return "Tenhle e-mail už v systému používá jiný účet.";
    case "account_password":
      return "Nové heslo musí mít aspoň 6 znaků.";
    case "account_pin":
      return "PIN musí mít přesně 4 čísla.";
    case "account_photo":
      return "Vyber fotku, kterou chceš nahrát.";
    case "account_photo_type":
      return "Fotka musí být obrázek.";
    case "account_photo_size":
      return "Fotka je moc velká. Použij menší soubor do 1,5 MB.";
    default:
      return null;
  }
}

export function WorkProfileAccountSection({ user, redirectTo, feedback, activeBaseRecord }: AccountSectionProps) {
  const accountError = accountErrorMessage(feedback?.error);

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Můj účet</p>
        <h2>Jméno, e-mail a heslo</h2>
      </div>
      {feedback?.welcome ? <p className="badge success">Účet je připravený. Tady můžeš kdykoliv upravit celý profil.</p> : null}
      {feedback?.saved === "account" ? <p className="badge success">Účet jsme uložili.</p> : null}
      {accountError ? <p className="alert">{accountError}</p> : null}
      {activeBaseRecord ? (
        <p className="badge success">
          Teď jsi v práci. Příchod zapsaný od {new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(activeBaseRecord.clockInAt))}.
        </p>
      ) : (
        <p className="badge neutral">Teď nejsi v práci.</p>
      )}

      <form action={updateMyAccountAction} className="grid-form">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label>
          Jméno
          <input type="text" name="name" defaultValue={user.name} required />
        </label>
        <label>
          E-mail
          <input type="email" name="email" defaultValue={user.email} required />
        </label>
        <label className="full">
          Nové heslo
          <input type="password" name="password" minLength={6} placeholder="Nech prázdné, pokud ho nechceš měnit" />
        </label>
        <label className="full">
          PIN do Základny
          <input
            type="password"
            name="pin"
            inputMode="numeric"
            pattern="[0-9]{4}"
            placeholder="4 čísla pro píchání"
          />
        </label>
        <button type="submit" className="button">
          Uložit účet
        </button>
      </form>

      <div className="stack gap-sm">
        <p className="eyebrow">Fotka</p>
        {user.photoDataUrl ? <img className="profile-photo-preview" src={user.photoDataUrl} alt={user.name} /> : null}
        {feedback?.saved === "photo" ? <p className="badge success">Fotku jsme uložili.</p> : null}
        <form action={updateMyPhotoAction} className="row gap-sm wrap" encType="multipart/form-data">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="file" name="photo" accept="image/*" required />
          <button type="submit" className="button ghost">
            Nahrát fotku
          </button>
        </form>
      </div>

      <div className="row gap-sm wrap">
        <AppLink className="button ghost" href="#preference-brigad">
          Upravit preference
        </AppLink>
      </div>
    </section>
  );
}

export function WorkProfilePreferencesSection({ user, redirectTo, feedback }: PreferencesSectionProps) {
  const shouldOpen = !user.onboardingCompleted || feedback?.saved === "preferences";

  return (
    <section className="panel stack" id="preference-brigad">
      <details className="stack" open={shouldOpen}>
        <summary className="button ghost summary-button">Upravit preference brigád</summary>
        <div className="stack">
          <div>
            <p className="eyebrow">Onboarding</p>
            <h2>Preference brigád</h2>
          </div>
          {!user.onboardingCompleted ? (
            <p className="alert">Ještě nemáš dokončené preference. Vyplň je, ať manager ví, kam tě nasazovat.</p>
          ) : null}
          {feedback?.saved === "preferences" ? <p className="badge success">Onboarding a preference jsou uložené.</p> : null}

          <form action={updateMyPreferencesAction} className="grid-form">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <fieldset className="full">
              <legend>Co preferuješ</legend>
              <div className="checkbox-grid">
                {STAFF_ROLES.map((role) => (
                  <label key={`preferred-${role}`} className="checkbox-pill">
                    <input type="checkbox" name="preferredRoles" value={role} defaultChecked={user.preferredRoles.includes(role)} />
                    <span>{staffRoleLabels[role]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="full">
              <legend>Kam rozhodně nechceš</legend>
              <div className="checkbox-grid">
                {STAFF_ROLES.map((role) => (
                  <label key={`excluded-${role}`} className="checkbox-pill">
                    <input type="checkbox" name="excludedRoles" value={role} defaultChecked={user.excludedRoles.includes(role)} />
                    <span>{staffRoleLabels[role]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="full">
              <legend>Kdy plánuješ brigádu</legend>
              <div className="checkbox-grid">
                {WORK_PERIODS.map((period) => (
                  <label key={period} className="checkbox-pill">
                    <input type="checkbox" name="workPeriods" value={period} defaultChecked={user.workPeriods.includes(period)} />
                    <span>{workPeriodLabels[period]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="full">
              <legend>Jaké dny ti sedí</legend>
              <div className="checkbox-grid">
                {WORK_DAY_PREFERENCES.map((value) => (
                  <label key={value} className="checkbox-pill">
                    <input
                      type="checkbox"
                      name="workDayPreferences"
                      value={value}
                      defaultChecked={user.workDayPreferences.includes(value)}
                    />
                    <span>{workDayPreferenceLabels[value]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" className="button">
              Uložit onboarding
            </button>
          </form>
        </div>
      </details>
    </section>
  );
}

export function WorkGoogleCalendarSection({
  user,
  redirectTo,
  googleConfigured,
  googleConnection,
  googleStatus,
}: GoogleSectionProps) {
  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Google Calendar</p>
        <h2>Automatické propsání směn</h2>
      </div>

      {googleStatus === "connected" ? <p className="badge success">Google Calendar je připojený.</p> : null}
      {googleStatus === "disconnected" ? <p className="badge neutral">Google Calendar je odpojený.</p> : null}
      {googleStatus === "error" ? <p className="alert">Napojení na Google Calendar se nepovedlo dokončit.</p> : null}
      {googleStatus === "unavailable" ? <p className="alert">Google Calendar zatím není nakonfigurovaný.</p> : null}

      {googleConfigured ? (
        googleConnection ? (
          <>
            <p className="subtle">
              Připojeno k účtu {googleConnection.calendarEmail ?? user.email}. Potvrzené směny se budou propisovat do Google Kalendáře.
            </p>
            <form action={disconnectGoogleCalendarAction}>
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <button type="submit" className="button ghost">
                Odpojit Google Calendar
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="subtle">Po připojení se ti potvrzené směny budou samy zapisovat do kalendáře.</p>
            <a className="button" href={`/api/google-calendar/connect?next=${encodeURIComponent(redirectTo)}`}>
              Propojit Google Calendar
            </a>
          </>
        )
      ) : (
        <p className="subtle">Až doplníme Google OAuth klíče, objeví se tady přímé propojení.</p>
      )}
    </section>
  );
}

export async function WorkBaseQrSection({ user }: BaseQrSectionProps) {
  const qrDataUrl = await createBaseAttendanceQrDataUrl(user.id);
  const backupCode = createBaseAttendanceToken(user.id);
  const escapeSvgText = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  const cardSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1180" viewBox="0 0 900 1180">
      <rect width="900" height="1180" rx="44" fill="#f5f1e8"/>
      <rect x="72" y="72" width="756" height="756" rx="36" fill="#ffffff"/>
      <image href="${qrDataUrl}" x="110" y="110" width="680" height="680" preserveAspectRatio="xMidYMid meet"/>
      <text x="450" y="930" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#114f43">${escapeSvgText(user.name)}</text>
      <text x="450" y="1010" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#5f6d65">QR pro Základnu</text>
      <text x="450" y="1060" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#7c877f">${escapeSvgText(backupCode)}</text>
    </svg>
  `.trim();
  const qrCardDownloadUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg)}`;
  const fileName = `qr-${user.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "uzivatel"}.svg`;

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Základna</p>
        <h2>Můj QR kód pro píchačku</h2>
      </div>
      <p className="subtle">
        Tenhle kód otevře příchod nebo odchod na základně přes kameru. Když QR zrovna nejde, můžeš se píchnout i přes svůj PIN.
      </p>
      <div className="base-profile-qr">
        <img src={qrDataUrl} alt={`QR kód pro ${user.name}`} />
      </div>
      <div className="stack gap-sm">
        <p className="tiny subtle">Záložní kód</p>
        <code className="base-backup-code">{backupCode}</code>
      </div>
      <a className="button ghost" href={qrCardDownloadUrl} download={fileName}>
        Stáhnout QR se jménem
      </a>
    </section>
  );
}
