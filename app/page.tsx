import type { CSSProperties } from "react";

import { PublicBrandLogo } from "@/components/public-brand-logo";
import { PublicMenuSwitcher } from "@/components/public-menu-switcher";
import { PublicOpeningHoursBubble } from "@/components/public-opening-hours-bubble";
import { PublicReservationForm } from "@/components/public-reservation-form";
import { PublicSiteHeader } from "@/components/public-site-header";
import { dailyMenuService, toMenuDateKey } from "@/lib/services/daily-menu";
import { homepageSectionsService } from "@/lib/services/homepage-sections";
import { siteSettingsService } from "@/lib/services/site-settings";

export const dynamic = "force-dynamic";

const SIGNATURE_DISHES = [
  {
    title: "Svíčková, která se vrací na stoly pořád dokola",
    description: "Jemná omáčka, poctivý základ a servis bez kompromisu. Nejčastější volba hostů po výletě.",
    imageClass: "signature-a",
  },
  {
    title: "Kachní stehno pro pomalejší oběd",
    description: "Křupavá kůže, zelí a knedlík přesně tak, jak má vypadat poctivá klasika.",
    imageClass: "signature-b",
  },
  {
    title: "Houbové rizoto s parmazánem",
    description: "Lehčí highlight, který funguje jako plnohodnotná volba, ne jako povinný kompromis.",
    imageClass: "signature-c",
  },
] as const;

const ACTIONS = [
  {
    title: "Svatby a oslavy",
    text: "Komorní svatba, rodinná oslava nebo větší setkání v klidném prostředí Českého ráje.",
  },
  {
    title: "Firemní posezení",
    text: "Obědy, večeře i neformální setkání pro menší skupiny s jednoduchou domluvou dopředu.",
  },
  {
    title: "Skupiny po výletě",
    text: "Zastávka pro turistické i cyklo skupiny s rezervací předem a přehledným menu na místě.",
  },
] as const;

const GALLERY_ITEMS = [
  { title: "Interiér", imageClass: "gallery-interior tall" },
  { title: "Večer", imageClass: "gallery-evening wide" },
  { title: "Detail servisu", imageClass: "gallery-detail" },
  { title: "Hosté", imageClass: "gallery-people tall" },
  { title: "Jídlo", imageClass: "gallery-food" },
] as const;

const REVIEWS = [
  { name: "Lucie K.", text: "Skvělé jídlo, klidná obsluha a přesně ten typ místa, kam se chceš vrátit.", rating: "★★★★★" },
  { name: "Martin P.", text: "Svíčková výborná, prostředí krásné a rezervace po telefonu bez komplikací.", rating: "★★★★★" },
  { name: "Tereza a Honza", text: "Příjemná zastávka po výletě, dobrá kuchyně a žádný turistický chaos.", rating: "★★★★★" },
  { name: "Pavel R.", text: "Místo má atmosféru, personál je v klidu a celé to působí poctivě.", rating: "★★★★★" },
] as const;

function buildAboutImageStyle(image: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(18, 28, 22, 0.08), rgba(18, 28, 22, 0.18)), url("${image}")`,
  };
}

export default async function HomePage() {
  const [aboutSection, siteSettings, publishedDailyMenu] = await Promise.all([
    homepageSectionsService.getAboutSection(),
    siteSettingsService.getPublicSettings(),
    dailyMenuService.getPublishedMenu(),
  ]);

  const publicMenuDate = publishedDailyMenu?.date ?? toMenuDateKey(new Date());
  const publicMenu = publishedDailyMenu?.menu ?? null;

  return (
    <main className="public-site">
      <PublicSiteHeader />
      <PublicOpeningHoursBubble openingHours={siteSettings.openingHours} />

      <section className="public-hero">
        <div className="public-hero-banner">
          <div className="public-shell public-hero-overlay">
            <div className="public-hero-copy public-hero-copy-split">
              <h1>
                <span>Klidná zastávka</span>
                <span>v rušném srdci</span>
                <span>Českého ráje</span>
              </h1>
              <div className="public-hero-actions">
                <a className="button public-hero-button" href="tel:+420777123456">
                  Rezervovat
                </a>
                <a className="button ghost public-hero-button" href="#menu">
                  Menu
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section" id="restaurace">
        <div className="public-shell public-about-grid">
          <div className="stack gap-lg public-about-copy">
            <div className="stack public-about-head">
              <h2 className="public-about-heading">{aboutSection.eyebrow}</h2>
              <p className="public-about-lead">{aboutSection.title}</p>
            </div>
            <div className="public-story-list">
              {aboutSection.points.map((item) => (
                <div key={item} className="public-story-point">
                  <span />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="public-about-image-wrap" aria-label="Fotografie restaurace">
            <div className="public-image-panel public-about-image" style={buildAboutImageStyle(aboutSection.primaryImage)} />
          </div>
        </div>
      </section>

      <section className="public-section alt" id="menu">
        <div className="public-shell stack gap-lg">
          <div className="stack">
            <p className="eyebrow">Menu</p>
            <h2>{publishedDailyMenu ? "Denní menu a nápoje v jednom přehledu." : "Denní menu zatím není zveřejněné."}</h2>
          </div>

          <PublicMenuSwitcher publishedDate={publicMenuDate} publishedMenu={publicMenu} />
        </div>
      </section>

      <section className="public-section" id="signature">
        <div className="public-shell stack gap-lg">
          <div className="stack">
            <p className="eyebrow">Výběr kuchyně</p>
            <h2>Jídla, která prodávají sama sebe.</h2>
          </div>
          <div className="public-signature-grid">
            {SIGNATURE_DISHES.map((dish, index) => (
              <article key={dish.title} className={`public-card public-signature-card ${index === 0 ? "featured" : ""}`.trim()}>
                <div className={`public-signature-media ${dish.imageClass}`} />
                <div className="stack">
                  <span className="public-signature-badge">Nejprodávanější</span>
                  <h3>{dish.title}</h3>
                  <p>{dish.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section alt" id="galerie">
        <div className="public-shell stack gap-lg">
          <div className="stack">
            <p className="eyebrow">Galerie</p>
            <h2>Jídlo, interiér i autenticita místa bez stylizace navíc.</h2>
          </div>
          <div className="public-gallery-grid">
            {GALLERY_ITEMS.map((item) => (
              <div key={item.title} className={`public-gallery-tile ${item.imageClass}`.trim()} aria-label={item.title} />
            ))}
          </div>
        </div>
      </section>

      <section className="public-section" id="akce">
        <div className="public-shell stack gap-lg">
          <div className="stack">
            <p className="eyebrow">Akce</p>
            <h2>Místo pro oslavy, firemní setkání i skupiny po výletě.</h2>
          </div>
          <div className="public-card-grid three">
            {ACTIONS.map((item) => (
              <article key={item.title} className="public-card stack">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section alt" id="rezervace">
        <div className="public-shell public-reservation-layout">
          <div className="stack gap-lg">
            <div className="stack">
              <p className="eyebrow">Rezervace</p>
              <h2>Stůl si můžeš rezervovat během minuty.</h2>
            </div>
            <p className="public-copy">
              Pro rychlou rezervaci vyplň základní údaje a odešli je e-mailem, nebo rovnou zavolej. Na víkendy a větší
              skupiny je telefon nejlepší volba.
            </p>
            <PublicReservationForm email="rezervace@vyskerdvur.cz" phone="+420 777 123 456" />
          </div>

          <div className="public-card stack public-quick-contact-card">
            <p className="eyebrow">Rychlý kontakt</p>
            <h3>Preferuješ telefon?</h3>
            <a className="button public-hero-button" href="tel:+420777123456">
              Zavolat do restaurace
            </a>
            <p className="public-muted">+420 777 123 456</p>
          </div>
        </div>
      </section>

      <section className="public-section" id="recenze">
        <div className="public-shell stack gap-lg">
          <div className="stack">
            <p className="eyebrow">Recenze</p>
            <h2>Tohle hosty přesvědčuje nejrychleji.</h2>
          </div>
          <div className="public-reviews-grid">
            {REVIEWS.map((review) => (
              <article key={review.name} className="public-card stack">
                <p className="public-review-rating">{review.rating}</p>
                <p>{review.text}</p>
                <strong>{review.name}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section alt" id="kontakt">
        <div className="public-shell public-contact-layout">
          <article className="public-card stack public-opening-card">
            <p className="eyebrow">Otevírací doba</p>
            <h2>Kdy máme otevřeno</h2>
            <div className="public-hours-list">
              {siteSettings.openingHours.map((day) => (
                <div key={day.key} className="public-hours-row">
                  <span>{day.label}</span>
                  <strong>{day.closed ? "Zavřeno" : `${day.open} - ${day.close}`}</strong>
                </div>
              ))}
            </div>
            <p className="public-hours-note">Pro rezervace na stejný den doporučujeme krátké telefonické ověření.</p>
          </article>

          <article className="public-card stack public-contact-card">
            <p className="eyebrow">Kontakt + mapa</p>
            <h2>Rezervace a dotazy</h2>
            <a className="public-contact-link" href="tel:+420777123456">
              +420 777 123 456
            </a>
            <a className="public-contact-link" href="mailto:rezervace@vyskerdvur.cz">
              rezervace@vyskerdvur.cz
            </a>
            <p>Vyskeř 24, 512 64 Vyskeř</p>
            <iframe
              title="Mapa restaurace Vyskeř"
              className="public-map-frame"
              src="https://www.google.com/maps?q=Vyske%C5%99%2024%2C%20512%2064%20Vyske%C5%99&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </article>
        </div>
      </section>

      <footer className="public-footer">
        <div className="public-shell public-footer-grid">
          <div className="stack">
            <a className="public-brand" href="#top">
              <PublicBrandLogo />
            </a>
            <p className="public-muted">Poctivá kuchyně, klidná atmosféra a místo, kam se hosté vrací rádi.</p>
          </div>

          <div className="stack">
            <p className="eyebrow">Navigace</p>
            <a href="#menu">Menu</a>
            <a href="#rezervace">Rezervace</a>
            <a href="#galerie">Fotky</a>
            <a href="#akce">Akce</a>
            <a href="#kontakt">Kontakt</a>
          </div>

          <div className="stack">
            <p className="eyebrow">Sítě</p>
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href="tel:+420777123456">+420 777 123 456</a>
            <a href="mailto:rezervace@vyskerdvur.cz">rezervace@vyskerdvur.cz</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
