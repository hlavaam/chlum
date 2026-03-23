import { MaintenanceAccessForm } from "@/components/maintenance-access-form";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <main className="maintenance-page">
      <section className="maintenance-panel">
        <div className="maintenance-copy stack gap-lg">
          <p className="maintenance-kicker">Restaurace Vyskeř</p>
          <div className="stack">
            <h1>Webové stránky pro vás právě připravujeme.</h1>
            <p className="maintenance-lead">
              Veřejnou verzi teď necháváme schovanou. Pokud potřebujete dovnitř na kontrolu, použijte vstupní heslo.
            </p>
          </div>
        </div>

        <aside className="maintenance-card">
          <MaintenanceAccessForm />
        </aside>
      </section>
    </main>
  );
}
