import { redirect } from "next/navigation";

import { WorkAppFrame } from "@/components/work-app-frame";
import {
  WorkBaseQrSection,
  WorkGoogleCalendarSection,
  WorkProfileAccountSection,
  WorkProfilePreferencesSection,
} from "@/components/work-profile-sections";
import { isBaseRole } from "@/lib/auth/role-access";
import { requireUser } from "@/lib/auth/rbac";
import { workPaths } from "@/lib/paths";
import { baseAttendanceService } from "@/lib/services/base-attendance";
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
  if (isBaseRole(user.role)) {
    redirect(workPaths.base);
  }
  const query = await searchParams;
  const googleStatus = readString(query?.google);
  const saved = readString(query?.saved);
  const error = readString(query?.error);
  const welcome = readString(query?.welcome) === "1";
  const [googleConnection, activeBaseRecord] = await Promise.all([
    calendarConnectionsService.findGoogleByUser(user.id),
    baseAttendanceService.activeForUser(user.id),
  ]);
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
        </section>

        <WorkProfileAccountSection
          user={user}
          redirectTo={workPaths.profile}
          feedback={{ saved, error, welcome }}
          activeBaseRecord={activeBaseRecord}
        />
        <WorkProfilePreferencesSection user={user} redirectTo={workPaths.profile} feedback={{ saved }} />
        <WorkBaseQrSection user={user} />
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
