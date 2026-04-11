"use client";

import { useState } from "react";

import { normalizePublicSiteSettings, PUBLIC_SITE_SETTINGS_ID } from "@/lib/site-settings";
import type { OpeningHoursDay, SiteSettingsRecord } from "@/types/models";

type Props = {
  initialSettings: SiteSettingsRecord;
};

type StatusTone = "" | "ok" | "error";

export function SiteSettingsAdmin({ initialSettings }: Props) {
  const [settings, setSettings] = useState(() => normalizePublicSiteSettings(initialSettings));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: StatusTone }>({ message: "", tone: "" });

  function updateDay(index: number, patch: Partial<OpeningHoursDay>) {
    setSettings((current) => {
      const nextHours = [...current.openingHours];
      nextHours[index] = { ...nextHours[index], ...patch };
      return { ...current, openingHours: nextHours };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus({ message: "", tone: "" });

    const payload = {
      id: PUBLIC_SITE_SETTINGS_ID,
      siteKey: "public",
      openingHours: settings.openingHours.map((day) => ({
        key: day.key,
        short: day.short,
        label: day.label,
        open: day.open.trim(),
        close: day.close.trim(),
        closed: day.closed,
      })),
    };

    try {
      const response = await fetch(`/api/site_settings/${PUBLIC_SITE_SETTINGS_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responsePayload = await response.json().catch(() => ({}));

      if (response.status === 404) {
        const createResponse = await fetch("/api/site_settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const createPayload = await createResponse.json().catch(() => ({}));
        if (!createResponse.ok) {
          throw new Error(typeof createPayload?.error === "string" ? createPayload.error : "Otevírací dobu se nepodařilo uložit.");
        }
        setSettings(normalizePublicSiteSettings(createPayload.data));
        setStatus({ message: "Otevírací doba byla vytvořena a uložena.", tone: "ok" });
        return;
      }

      if (!response.ok) {
        throw new Error(typeof responsePayload?.error === "string" ? responsePayload.error : "Otevírací dobu se nepodařilo uložit.");
      }

      setSettings(normalizePublicSiteSettings(responsePayload.data));
      setStatus({ message: "Otevírací doba byla uložena.", tone: "ok" });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Otevírací dobu se nepodařilo uložit.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel stack site-settings-admin">
      <div className="stack">
        <p className="eyebrow">Homepage / Otevírací doba</p>
        <h2>Úprava otevírací doby</h2>
        <p className="subtle">Časy se propsají do kontaktu na webu i do plovoucí bubliny po scrollu.</p>
      </div>

      <form className="stack gap-lg" onSubmit={handleSubmit}>
        <div className="site-settings-hours">
          {settings.openingHours.map((day, index) => (
            <div key={day.key} className="site-settings-hours-row">
              <div className="stack">
                <strong>{day.label}</strong>
                <span className="subtle">{day.short}</span>
              </div>

              <label className="inline site-settings-hours-closed">
                <input
                  type="checkbox"
                  checked={day.closed}
                  onChange={(event) => updateDay(index, { closed: event.target.checked })}
                />
                Zavřeno
              </label>

              <label>
                Od
                <input
                  type="time"
                  value={day.open}
                  disabled={day.closed}
                  onChange={(event) => updateDay(index, { open: event.target.value })}
                />
              </label>

              <label>
                Do
                <input
                  type="time"
                  value={day.close}
                  disabled={day.closed}
                  onChange={(event) => updateDay(index, { close: event.target.value })}
                />
              </label>
            </div>
          ))}
        </div>

        <p className={`admin-status ${status.tone}`.trim()}>
          {status.message || "Bublina na webu ukazuje dnešní režim podle těchto hodnot."}
        </p>

        <div className="row gap-sm wrap">
          <button type="submit" className="button" disabled={saving}>
            {saving ? "Ukládám..." : "Uložit otevírací dobu"}
          </button>
        </div>
      </form>
    </section>
  );
}
