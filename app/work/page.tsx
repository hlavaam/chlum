import { redirect } from "next/navigation";

import { WorkLoginForm } from "@/components/work-login-form";
import { getDefaultPostLoginPath } from "@/lib/auth/login-target";
import { getCurrentUser } from "@/lib/auth/session";
import { workPaths } from "@/lib/paths";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WorkLoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) {
    redirect(getDefaultPostLoginPath(user.role));
  }

  const params = await searchParams;
  const error = readString(params.error);
  const nextPath = readString(params.next);

  return (
    <div className="login-page">
      <div className="login-card">
        <div>
          <p className="eyebrow">Restaurace Vyskeř / Work</p>
          <h1>Přihlášení pro brigádníky</h1>
        </div>

        <WorkLoginForm initialError={Boolean(error)} nextPath={nextPath} loginPath={workPaths.login} />
      </div>
    </div>
  );
}
