import { redirect } from "next/navigation";

import { loginAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth/session";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) redirect("/employees");
  const params = await searchParams;
  const error = params.error;

  return (
    <div className="login-page">
      <div className="login-card">
        <div>
          <p className="eyebrow">Chlum / Employees</p>
          <h1>Přihlášení</h1>
        </div>

        {error ? <p className="alert">Neplatný e-mail nebo heslo.</p> : null}

        <form action={loginAction} className="stack">
          <label>
            E-mail
            <input type="email" name="email" defaultValue="petra@chlum.local" required />
          </label>
          <label>
            Heslo
            <input type="password" name="password" defaultValue="brigadnik123" required />
          </label>
          <button type="submit" className="button">
            Přihlásit
          </button>
        </form>
      </div>
    </div>
  );
}
