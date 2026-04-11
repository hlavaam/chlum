"use client";

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";

import { PublicBrandLogo } from "@/components/public-brand-logo";

const NAV_ITEMS = [
  { id: "menu", label: "Menu" },
  { id: "rezervace", label: "Rezervace" },
  { id: "galerie", label: "Fotky" },
  { id: "akce", label: "Akce" },
  { id: "kontakt", label: "Kontakt" },
] as const;

export function PublicSiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    function updateScrolled() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      setScrolled(scrollTop > 16);
    }

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) {
      return undefined;
    }

    function updateActiveSection() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const probeY = scrollTop + 140;

      if (scrollTop < 120) {
        setActiveSection("");
        return;
      }

      const currentSection = sections.find((section) => {
        const top = section.offsetTop;
        const bottom = top + section.offsetHeight;
        return probeY >= top && probeY < bottom;
      });

      setActiveSection(currentSection?.id ?? "");
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, targetId: string) {
    event.preventDefault();

    if (targetId === "top") {
      setActiveSection("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const element = document.getElementById(targetId);
    if (!element) {
      return;
    }

    setActiveSection(targetId);
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <header className={`public-header ${scrolled ? "scrolled" : ""}`.trim()} id="top">
      <div className="public-shell public-header-row">
        <a className="public-brand" href="#top" onClick={(event) => handleNavigate(event, "top")}>
          <PublicBrandLogo priority />
        </a>
        <nav className="public-nav" aria-label="Hlavní navigace">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={activeSection === item.id ? "active" : ""}
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={(event) => handleNavigate(event, item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
