import { WorkAppFrame } from "@/components/work-app-frame";
import { AppLink } from "@/components/app-link";
import {
  WorkGoogleCalendarSection,
  WorkProfileAccountSection,
  WorkProfilePreferencesSection,
} from "@/components/work-profile-sections";
import { requireUser } from "@/lib/auth/rbac";
import { workPaths } from "@/lib/paths";
import { calendarConnectionsService } from "@/lib/services/calendar-connections";
import { isGoogleCalendarConfigured } from "@/lib/services/google-calendar-sync";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WorkProfilePage({ searchParams }: Props) {
  const user = await requireUser({ loginPath: workPaths.login });
  const query = await searchParams;
  const googleStatus = readString(query?.google);
  const saved = readString(query?.saved);
  const error = readString(query?.error);
  const welcome = readString(query?.welcome) === "1";
  const [googleConnection] = await Promise.all([calendarConnectionsService.findGoogleByUser(user.id)]);
  const googleConfigured = isGoogleCalendarConfigured();

  return (
    <WorkAppFrame>
      <div className="stack gap-lg">
        <section className="panel stack">
          <div>
            <p className="eyebrow">Work profil</p>
            <h1>Můj účet a onboarding</h1>
          </div>
          <p className="subtle">
            Tady máš otevřený celý účet. Kdykoliv si můžeš změnit jméno, e-mail, heslo, preference brigád i propojení s Google
            Calendar.
          </p>
          <div className="row gap-sm wrap">
            <AppLink className="button" href="#preference-brigad">
              Změnit preference
            </AppLink>
          </div>
        </section>

        <WorkProfileAccountSection user={user} redirectTo={workPaths.profile} feedback={{ saved, error, welcome }} />
        <WorkProfilePreferencesSection user={user} redirectTo={workPaths.profile} feedback={{ saved }} />
        <WorkGoogleCalendarSection
          user={user}
          redirectTo={workPaths.profile}
          googleConfigured={googleConfigured}
          googleConnection={googleConnection}
          googleStatus={googleStatus}
        />
      </div>
    </WorkAppFrame>
  );
}
