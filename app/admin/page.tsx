import { redirect } from "next/navigation";

import { WorkLoginForm } from "@/components/work-login-form";
import { getDefaultPostLoginPath } from "@/lib/auth/login-target";
import { isManagerRole } from "@/lib/auth/role-access";
import { getCurrentUser } from "@/lib/auth/session";
import { adminPaths } from "@/lib/paths";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user && !isManagerRole(user.role)) {
    redirect(getDefaultPostLoginPath(user.role));
  }

  const params = await searchParams;
  const error = readString(params.error);
  const nextPath = readString(params.next);

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card admin-login-card">
          <div className="stack">
            <p className="eyebrow">Restaurace Vyskeř / Admin</p>
            <h1>Přihlášení do adminu</h1>
            <p className="subtle">Do adminu mohou jen účty s rolí manager nebo admin. Přihlášení používá stejný účet jako work.</p>
          </div>

          <WorkLoginForm
            initialError={Boolean(error)}
            nextPath={nextPath}
            submitLabel="Vstoupit do adminu"
            loginPath={adminPaths.login}
          />
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel stack admin-dashboard-hero">
        <p className="eyebrow">Restaurace Vyskeř / Admin</p>
        <h1>Správa webu</h1>
        <p className="subtle">Rychlý rozcestník pro obsah veřejného webu. První hotová část je editor denního jídeláku a jeho tisk.</p>
      </section>

      <section className="admin-dashboard-grid">
        <a className="panel stack admin-dashboard-card primary" href={adminPaths.adminMenu}>
          <p className="eyebrow">Menu</p>
          <h2>Denní jídelák</h2>
          <p>Editor denního menu, přehled uložených dní a tisk do PDF na A4 nebo A5.</p>
        </a>

        <a className="panel stack admin-dashboard-card" href={adminPaths.adminWeb}>
          <p className="eyebrow">Web</p>
          <h2>Obsah homepage</h2>
          <p>Úprava sekce O nás včetně nadpisu, textových bodů a obrázků přímo z adminu.</p>
        </a>

        <section className="panel stack admin-dashboard-card">
          <p className="eyebrow">Kontakt</p>
          <h2>Základní informace</h2>
          <p>Další vhodná část adminu je úprava telefonu, e-mailu, otevírací doby a krátkých textů na veřejném webu.</p>
        </section>
      </section>
    </main>
  );
}
