import { disconnectGoogleCalendarAction, updateMyAccountAction, updateMyPreferencesAction } from "@/lib/actions";
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
    default:
      return null;
  }
}

export function WorkProfileAccountSection({ user, redirectTo, feedback }: AccountSectionProps) {
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
        <button type="submit" className="button">
          Uložit účet
        </button>
      </form>
    </section>
  );
}

export function WorkProfilePreferencesSection({ user, redirectTo, feedback }: PreferencesSectionProps) {
  return (
    <section className="panel stack">
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
