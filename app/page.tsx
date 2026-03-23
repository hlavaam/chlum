import { AppLink } from "@/components/app-link";
import { PublicDailyMenu } from "@/components/public-daily-menu";
import { getCurrentUser } from "@/lib/auth/session";
import { staffPaths } from "@/lib/paths";
import { dailyMenuService, toMenuDateKey } from "@/lib/services/daily-menu";

export const dynamic = "force-dynamic";

const ROOM_OFFERS = [
  { label: "2 osoby", title: "Standard", text: "Klidný pokoj se snídaní a výhledem do dvora.", price: "od 1 890 Kč / noc" },
  {
    label: "2-4 osoby",
    title: "Rodinný apartmán",
    text: "Samostatná ložnice, větší koupelna a pohodlné zázemí na delší pobyt.",
    price: "od 2 690 Kč / noc",
  },
  { label: "2 osoby", title: "Deluxe", text: "Prostornější pokoj pro víkend ve dvou a pomalejší rána.", price: "od 2 390 Kč / noc" },
];

const EXPERIENCES = [
  {
    title: "Svatby ve dvoře",
    text: "Kompletní servis od obřadu přes hostinu až po večerní raut. Kapacita až 80 hostů.",
  },
  {
    title: "Firemní setkání",
    text: "Salonek, catering, ubytování i program v okolním Českém ráji připravíme na míru.",
  },
  {
    title: "Rodinné oslavy",
    text: "Nedělní oběd, narozeniny i menší setkání se zázemím, které nepůsobí jako pronajatý sál.",
  },
];

export default async function HomePage() {
  const today = toMenuDateKey(new Date());
  const [user, todayMenu] = await Promise.all([getCurrentUser(), dailyMenuService.getMenu(today)]);
  const staffHref = user ? staffPaths.employees : staffPaths.login;
  const staffLabel = user ? "Pokračovat do plánování" : "Vstup pro brigádníky";

  return (
    <main className="public-site">
      <header className="public-header" id="top">
        <div className="public-shell public-header-row">
          <a className="public-brand" href="#top">
            <span className="public-brand-mark">V</span>
            <span>Vyskeř Dvůr</span>
          </a>
          <nav className="public-nav" aria-label="Hlavní navigace">
            <a href="#restaurace">Restaurace</a>
            <a href="#ubytovani">Ubytování</a>
            <a href="#akce">Akce</a>
            <a href="#kontakt">Kontakt</a>
            <AppLink href={staffHref}>{staffLabel}</AppLink>
          </nav>
        </div>
      </header>

      <section className="public-hero">
        <div className="public-shell public-hero-grid">
          <div className="stack gap-lg">
            <div className="stack">
              <p className="eyebrow">Restaurace a penzion v Českém ráji</p>
              <h1>Poctivá kuchyně, klidné spaní a zázemí, které zvládne i rušný provoz.</h1>
              <p className="public-lead">
                Web restaurace, denní menu i interní systém brigádníků teď běží v jedné aplikaci. Pro hosty je to čistý
                web Vyskeře, pro tým přehledná interní sekce na stejné doméně.
              </p>
            </div>

            <div className="public-cta-row">
              <a className="button" href="#kontakt">
                Rezervovat stůl
              </a>
              <a className="button ghost" href="#ubytovani">
                Poptat ubytování
              </a>
              <AppLink className="button ghost" href={staffHref}>
                {staffLabel}
              </AppLink>
            </div>

            <div className="public-stats">
              <article>
                <strong>28</strong>
                <span>míst k ubytování</span>
              </article>
              <article>
                <strong>7 min</strong>
                <span>od Hruboskalska</span>
              </article>
              <article>
                <strong>365 dní</strong>
                <span>provoz restaurace a akcí</span>
              </article>
            </div>
          </div>

          <aside className="public-hero-card">
            <p className="eyebrow">Dnes ve Vyskři</p>
            <h2>Hosté vidí web. Tým řídí směny v interní části.</h2>
            <p className="public-muted">
              Interní plánování je nově schované pod `/brigadnici`, takže veřejná prezentace restaurace a provozní systém
              si nepřekáží.
            </p>
            <div className="public-chip-row">
              <span className="chip">Restaurace</span>
              <span className="chip">Penzion</span>
              <span className="chip">Svatby</span>
              <span className="chip">Brigádníci</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="public-section" id="restaurace">
        <div className="public-shell public-section-grid">
          <div className="stack gap-md">
            <div className="stack">
              <p className="eyebrow">Restaurace</p>
              <h2>Místo, kde po výletu nechcete jen rychle obědvat.</h2>
            </div>
            <p className="public-copy">
              Vyskeř spojuje rodinnou restauraci, penzion a zázemí pro svatby i firemní akce. Přijeďte na oběd po
              výšlapu, víkend ve dvou nebo vícedenní akci, kde se nemusí nic improvizovat.
            </p>
            <div className="public-feature-list">
              <div className="public-card">
                <h3>Stálý jídelní lístek</h3>
                <p>Svíčková, poctivé polévky, ryby i lehčí sezónní jídla bez turistické šablony.</p>
              </div>
              <div className="public-card">
                <h3>Nápoje a dezerty</h3>
                <p>Výběrová káva, regionální vína, domácí limonády a dezerty, které nehraje jen vitrína.</p>
              </div>
            </div>
          </div>

          <PublicDailyMenu initialDate={today} initialMenu={todayMenu} />
        </div>
      </section>

      <section className="public-section alt" id="ubytovani">
        <div className="public-shell stack gap-lg">
          <div className="stack">
            <p className="eyebrow">Ubytování</p>
            <h2>Pokoje s pohodlím po dni na stezkách.</h2>
          </div>
          <div className="public-card-grid three">
            {ROOM_OFFERS.map((room) => (
              <article key={room.title} className="public-card room-card">
                <p className="chip">{room.label}</p>
                <h3>{room.title}</h3>
                <p>{room.text}</p>
                <strong>{room.price}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section" id="akce">
        <div className="public-shell stack gap-lg">
          <div className="stack">
            <p className="eyebrow">Svatby a eventy</p>
            <h2>Od komorní oslavy po plný provoz s týmem brigádníků.</h2>
          </div>
          <div className="public-card-grid three">
            {EXPERIENCES.map((item) => (
              <article key={item.title} className="public-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section alt" id="kontakt">
        <div className="public-shell public-contact-grid">
          <article className="public-card stack">
            <p className="eyebrow">Kontakt</p>
            <h2>Restaurace a Penzion Vyskeř</h2>
            <p>Vyskeř 24, 512 64 Vyskeř</p>
            <p>+420 777 123 456</p>
            <p>rezervace@vyskerdvur.cz</p>
          </article>

          <article className="public-card stack">
            <p className="eyebrow">Otevírací doba</p>
            <h2>Restaurace</h2>
            <p>Po-Čt: 11:00-22:00</p>
            <p>Pá-So: 11:00-23:00</p>
            <p>Ne: 11:00-21:00</p>
          </article>

          <article className="public-card stack">
            <p className="eyebrow">Interní sekce</p>
            <h2>Plánování brigádníků</h2>
            <p>Kalendář směn, eventy, lidé a nově i správa denního menu.</p>
            <AppLink className="button" href={staffHref}>
              {staffLabel}
            </AppLink>
          </article>
        </div>
      </section>
    </main>
  );
}
