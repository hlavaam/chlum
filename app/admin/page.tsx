import { redirect } from "next/navigation";

import { loginAdminAction } from "@/lib/actions";
import { isManagerRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { workPaths } from "@/lib/paths";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user && isManagerRole(user.role)) {
    redirect(workPaths.schedule);
  }
  if (user?.role === "brigadnik") {
    redirect(workPaths.employees);
  }

  const params = await searchParams;
  const error = readString(params.error);

  return (
    <div className="login-page">
      <div className="login-card">
        <div>
          <p className="eyebrow">Restaurace Vyskeř / Admin</p>
          <h1>Přihlášení do správy</h1>
        </div>

        {error ? <p className="alert">Neplatný e-mail, heslo nebo oprávnění.</p> : null}

        <form action={loginAdminAction} className="stack">
          <label>
            E-mail
            <input type="email" name="email" required />
          </label>
          <label>
            Heslo
            <input type="password" name="password" required />
          </label>
          <button type="submit" className="button">
            Vstoupit do adminu
          </button>
        </form>
      </div>
    </div>
  );
}
