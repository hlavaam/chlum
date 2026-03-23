import { redirect } from "next/navigation";

import { loginWorkAction } from "@/lib/actions";
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
    redirect(workPaths.employees);
  }

  const params = await searchParams;
  const error = readString(params.error);

  return (
    <div className="login-page">
      <div className="login-card">
        <div>
          <p className="eyebrow">Restaurace Vyskeř / Work</p>
          <h1>Přihlášení pro brigádníky</h1>
        </div>

        {error ? <p className="alert">Neplatný e-mail nebo heslo.</p> : null}

        <form action={loginWorkAction} className="stack">
          <label>
            E-mail
            <input type="email" name="email" required />
          </label>
          <label>
            Heslo
            <input type="password" name="password" required />
          </label>
          <button type="submit" className="button">
            Vstoupit do worku
          </button>
        </form>
      </div>
    </div>
  );
}
