"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DaySummaryEntry = [
  string,
  {
    locationSummaries: Array<{
      locationId: string;
      minimumPeople: number;
      confirmedCount: number;
      pendingCount: number;
    }>;
  },
];

type PresetDefinition = {
  key: string;
  label: string;
  description: string;
  startTime: string;
  endTime: string;
  minimumPeople: number;
};

type Props = {
  weekDays: string[];
  locations: Array<{ id: string; name: string; code: string }>;
  summaryEntries: DaySummaryEntry[];
  presets: PresetDefinition[];
  initialLocationId?: string;
};

function weekdayLabel(date: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function WorkShiftPresetBoard({ weekDays, locations, summaryEntries, presets, initialLocationId }: Props) {
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId ?? locations[0]?.id ?? "");
  const [selectedPresetKey, setSelectedPresetKey] = useState(presets[0]?.key ?? "");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summaryMap = new Map(summaryEntries);

  const createPresetShift = (date: string, presetKey: string) => {
    if (!selectedLocationId || !presetKey) return;
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/work/preset-shifts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          locationId: selectedLocationId,
          presetKey,
          requiresApproval,
        }),
      });
      if (!response.ok) {
        setMessage("Preset směny se nepodařilo uložit.");
        return;
      }
      setMessage(`Směna přidaná na ${date}.`);
      router.refresh();
    });
  };

  return (
    <section className="panel stack work-preset-panel desktop-only">
      <div className="row between wrap">
        <div>
          <p className="eyebrow">PC rychlý režim</p>
          <h3>Preset směny přetažením do týdne</h3>
        </div>
        <p className="subtle tiny">Přetáhni kartu do dne, nebo nejdřív preset vyber a klikni na „Přidat vybraný preset“.</p>
      </div>

      <div className="work-preset-board">
        <aside className="work-preset-rail stack">
          <label>
            Pobočka pro přetažení
            <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} • {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(event) => setRequiresApproval(event.target.checked)}
            />
            Vytvářet jako schvalovanou směnu
          </label>
          <div className="stack gap-sm">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                draggable
                className={`preset-card ${selectedPresetKey === preset.key ? "active" : ""}`.trim()}
                onClick={() => setSelectedPresetKey(preset.key)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData("text/plain", preset.key);
                  setSelectedPresetKey(preset.key);
                }}
              >
                <strong>{preset.label}</strong>
                <span className="subtle tiny">
                  {preset.startTime}–{preset.endTime} • min {preset.minimumPeople}
                </span>
                <span className="subtle tiny">{preset.description}</span>
              </button>
            ))}
          </div>
          {message ? <p className="subtle tiny">{message}</p> : null}
        </aside>

        <div className="work-preset-days">
          {weekDays.map((date) => {
            const summary = summaryMap.get(date);
            return (
              <article
                key={date}
                className="preset-drop-day"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const presetKey = event.dataTransfer.getData("text/plain") || selectedPresetKey;
                  createPresetShift(date, presetKey);
                }}
              >
                <div className="row between">
                  <strong>{weekdayLabel(date)}</strong>
                  <button
                    type="button"
                    className="button ghost small"
                    disabled={pending || !selectedPresetKey || !selectedLocationId}
                    onClick={() => createPresetShift(date, selectedPresetKey)}
                  >
                    Přidat vybraný preset
                  </button>
                </div>

                <div className="stack gap-sm">
                  {(summary?.locationSummaries ?? []).length === 0 ? (
                    <p className="subtle tiny">Zatím bez provozu.</p>
                  ) : (
                    summary?.locationSummaries.map((locationSummary) => {
                      const location = locations.find((item) => item.id === locationSummary.locationId);
                      return (
                        <div key={locationSummary.locationId} className="preset-drop-summary">
                          <p>
                            <strong>{location?.code ?? "Pobočka"}</strong> • {locationSummary.confirmedCount}/
                            {locationSummary.minimumPeople}
                            {locationSummary.pendingCount ? ` (+${locationSummary.pendingCount})` : ""}
                          </p>
                          <p className="subtle tiny">{location?.name ?? locationSummary.locationId}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
