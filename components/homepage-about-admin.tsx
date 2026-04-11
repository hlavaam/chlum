"use client";

import { useState } from "react";

import { HOMEPAGE_ABOUT_SECTION_ID, normalizeHomepageAboutSection } from "@/lib/homepage-about";
import type { HomepageSectionRecord } from "@/types/models";

type Props = {
  initialSection: HomepageSectionRecord;
};

type StatusTone = "" | "ok" | "error";

function buildImagePreview(image: string) {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(18, 28, 22, 0.12), rgba(18, 28, 22, 0.22)), url("${image}")`,
  };
}

export function HomepageAboutAdmin({ initialSection }: Props) {
  const [section, setSection] = useState(() => normalizeHomepageAboutSection(initialSection));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: StatusTone }>({ message: "", tone: "" });

  function updatePoint(index: number, value: string) {
    setSection((current) => {
      const nextPoints = [...current.points];
      nextPoints[index] = value;
      return { ...current, points: nextPoints };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus({ message: "", tone: "" });

    const payload = {
      id: HOMEPAGE_ABOUT_SECTION_ID,
      sectionKey: "about",
      eyebrow: section.eyebrow.trim(),
      title: section.title.trim(),
      points: section.points.map((item) => item.trim()),
      primaryImage: section.primaryImage.trim(),
      secondaryImage: section.secondaryImage.trim(),
    };

    try {
      const response = await fetch(`/api/homepage_sections/${HOMEPAGE_ABOUT_SECTION_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 404) {
        const createResponse = await fetch("/api/homepage_sections", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const createPayload = await createResponse.json().catch(() => ({}));
        if (!createResponse.ok) {
          throw new Error(typeof createPayload?.error === "string" ? createPayload.error : "Sekci se nepodařilo uložit.");
        }
        setSection(normalizeHomepageAboutSection(createPayload.data));
        setStatus({ message: "Sekce O nás byla vytvořena a uložena.", tone: "ok" });
        return;
      }

      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof responsePayload?.error === "string" ? responsePayload.error : "Sekci se nepodařilo uložit.");
      }

      setSection(normalizeHomepageAboutSection(responsePayload.data));
      setStatus({ message: "Sekce O nás byla uložena.", tone: "ok" });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Sekci se nepodařilo uložit.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel stack homepage-about-admin">
      <div className="stack">
        <p className="eyebrow">Homepage / O nás</p>
        <h2>Úprava sekce O nás</h2>
        <p className="subtle">Změníš nadpis, tři hlavní body a dva obrázky, které se hned propsají na veřejný web.</p>
      </div>

      <form className="stack gap-lg" onSubmit={handleSubmit}>
        <div className="homepage-about-admin-grid">
          <div className="stack gap-lg">
            <label>
              Malý nadpis sekce
              <input
                type="text"
                value={section.eyebrow}
                onChange={(event) => setSection((current) => ({ ...current, eyebrow: event.target.value }))}
                placeholder="O nás"
              />
            </label>

            <label>
              Hlavní nadpis
              <textarea
                value={section.title}
                onChange={(event) => setSection((current) => ({ ...current, title: event.target.value }))}
                placeholder="Poctivá kuchyně, lokální suroviny..."
              />
            </label>

            <div className="homepage-about-points">
              {section.points.map((point, index) => (
                <label key={index}>
                  Bod {index + 1}
                  <textarea value={point} onChange={(event) => updatePoint(index, event.target.value)} />
                </label>
              ))}
            </div>

            <div className="homepage-about-image-fields">
              <label>
                Obrázek 1
                <input
                  type="text"
                  value={section.primaryImage}
                  onChange={(event) => setSection((current) => ({ ...current, primaryImage: event.target.value }))}
                  placeholder="/hero/interier-1.jpg"
                />
              </label>

              <label>
                Obrázek 2
                <input
                  type="text"
                  value={section.secondaryImage}
                  onChange={(event) => setSection((current) => ({ ...current, secondaryImage: event.target.value }))}
                  placeholder="/hero/interier-2.jpg"
                />
              </label>
            </div>

            <p className={`admin-status ${status.tone}`.trim()}>
              {status.message || "Tip: používej cesty k souborům v /public, například /hero/kaplicka.jpg"}
            </p>

            <div className="row gap-sm wrap">
              <button type="submit" className="button" disabled={saving}>
                {saving ? "Ukládám..." : "Uložit sekci"}
              </button>
              <a className="button ghost" href="/" target="_blank" rel="noreferrer">
                Otevřít web
              </a>
            </div>
          </div>

          <div className="panel stack homepage-about-preview">
            <div className="stack">
              <p className="eyebrow">{section.eyebrow || "O nás"}</p>
              <h2>{section.title || "Poctivá kuchyně, lokální suroviny a atmosféra, která se nesnaží být hlučná."}</h2>
            </div>

            <div className="public-story-list homepage-about-preview-points">
              {section.points.map((point, index) => (
                <div key={index} className="public-story-point">
                  <span />
                  <p>{point || `Text bodu ${index + 1}`}</p>
                </div>
              ))}
            </div>

            <div className="homepage-about-preview-images">
              <div className="homepage-about-preview-image" style={buildImagePreview(section.primaryImage || "/hero/kaplicka.jpg")} />
              <div className="homepage-about-preview-image secondary" style={buildImagePreview(section.secondaryImage || "/hero/kaplicka.jpg")} />
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
