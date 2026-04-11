"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function ZakladnaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneMode());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed) {
    return null;
  }

  async function handleInstall() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    console.info("[zakladna-pwa] Install prompt finished.", choice);
    if (choice?.outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  return (
    <section className="panel stack zakladna-install-panel">
      <div className="row between wrap gap-sm">
        <div>
          <p className="eyebrow">Aplikace pro Základnu</p>
          <h2>Spouštěj Základnu jako appku</h2>
        </div>
        {installPrompt ? (
          <button type="button" className="button" onClick={() => void handleInstall()}>
            Nainstalovat appku
          </button>
        ) : null}
      </div>
      <p className="subtle">
        Po instalaci se Základna otevře bez běžného browser rozhraní a půjde připnout na plochu jako samostatná aplikace.
      </p>
      {!installPrompt ? (
        <div className="stack gap-xs">
          <p className="tiny subtle">
            Na starém Androidu nebo na kase se tlačítko často vůbec neukáže. Tam se instalace dělá ručně přes menu Chrome.
          </p>
          <p className="tiny subtle">
            Otevři <strong>Chrome</strong> → menu <strong>⋮</strong> → <strong>Přidat na plochu</strong> nebo{" "}
            <strong>Instalovat aplikaci</strong>.
          </p>
        </div>
      ) : null}
    </section>
  );
}
