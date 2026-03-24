"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { createShiftPresetAction, deleteShiftPresetAction } from "@/lib/actions";
import { SHIFT_TYPES, STAFF_ROLES, staffRoleLabels, shiftTypeLabels } from "@/lib/constants";
import type { LocationRecord } from "@/types/models";
import type { ShiftPresetRecord } from "@/types/models";

type LocationColor = {
  bg: string;
  border: string;
  text: string;
};

type CalendarLocationRow = {
  shiftId: string;
  locationLabel: string;
  timeLabel: string;
  roleStats: Array<{
    label: string;
    assigned: number;
    required: number;
  }>;
  isMine: boolean;
  color?: LocationColor;
};

type CalendarDayCard = {
  date: string;
  dayNumber: number;
  weekdayLabel: string;
  href: string;
  className: string;
  shifts: CalendarLocationRow[];
  emptyStateLabel: string;
};

type WorkCalendarBoardProps = {
  days: CalendarDayCard[];
  view: "week" | "month";
  canSelfAssign: boolean;
  canManageCalendar: boolean;
  locations: LocationRecord[];
  shiftPresets: ShiftPresetRecord[];
  currentHref: string;
  presetCreated: boolean;
  presetDeleted: boolean;
};

export function WorkCalendarBoard({
  days,
  view,
  canSelfAssign,
  canManageCalendar,
  locations,
  shiftPresets,
  currentHref,
  presetCreated,
  presetDeleted,
}: WorkCalendarBoardProps) {
  const router = useRouter();
  const lastDropAtRef = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [enabledRoles, setEnabledRoles] = useState<Record<string, boolean>>({
    plac: true,
    kitchen: true,
    cleaning: false,
  });

  async function handleDrop(date: string, presetId: string) {
    setBusyTarget(date);
    lastDropAtRef.current = Date.now();
    try {
      const response = await fetch("/api/work/preset-shifts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, presetId }),
      });
      if (!response.ok) {
        throw new Error("Preset drop failed");
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      window.alert("Preset se nepodařilo přidat do kalendáře.");
    } finally {
      setBusyTarget(null);
      setDropTarget(null);
      setActivePresetId(null);
    }
  }

  function handleDayOpen(href: string) {
    if (Date.now() - lastDropAtRef.current < 350) return;
    router.push(href, { scroll: false });
  }

  return (
    <>
      <section className={`calendar-workspace ${canManageCalendar && sidebarOpen ? "with-sidebar" : ""}`.trim()}>
        <div className="calendar-main stack">
          {canManageCalendar ? (
            <div className="row between wrap calendar-main-toolbar">
              <div className="row gap-sm wrap">
                {presetCreated ? <p className="badge success">Preset byl uložený.</p> : null}
                {presetDeleted ? <p className="badge neutral">Preset byl smazaný.</p> : null}
              </div>
              <button
                type="button"
                className="button ghost small preset-sidebar-toggle desktop-only"
                onClick={() => setSidebarOpen((value) => !value)}
              >
                <span aria-hidden>{sidebarOpen ? "→" : "←"}</span>
                {sidebarOpen ? "Skrýt presety" : "Zobrazit presety"}
              </button>
            </div>
          ) : null}

          <section className={view === "month" ? "calendar-grid month" : "calendar-grid week"}>
            {days.map((day) => (
              <article
                key={day.date}
                className={`${day.className} day-card-clickable ${dropTarget === day.date ? "drop-active" : ""}`.trim()}
                role="button"
                tabIndex={0}
                aria-label={`Otevřít směny dne ${day.date}`}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("a, button, input, select, textarea, label, form")) return;
                  handleDayOpen(day.href);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  handleDayOpen(day.href);
                }}
                onDragOver={(event) => {
                  if (!canManageCalendar || !activePresetId) return;
                  event.preventDefault();
                  setDropTarget(day.date);
                }}
                onDragLeave={() => {
                  if (dropTarget === day.date) setDropTarget(null);
                }}
                onDrop={(event) => {
                  if (!canManageCalendar) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const presetId = event.dataTransfer.getData("text/preset") || activePresetId;
                  if (!presetId) return;
                  void handleDrop(day.date, presetId);
                }}
              >
                <div className="day-card-header">
                  <strong className="day-card-date">{day.dayNumber}.</strong>
                  <span className="day-card-weekday">{day.weekdayLabel}</span>
                </div>

                {day.shifts.length > 0 ? (
                  <div className="stack day-shift-list">
                    {day.shifts.map((row) => {
                      const isBusy = busyTarget === day.date;

                      return (
                        <div
                          key={`${day.date}-${row.shiftId}`}
                          className={`day-location-row shift-summary-row ${row.isMine ? "mine-row" : ""}`.trim()}
                          style={
                            row.color
                              ? {
                                  backgroundColor: row.color.bg,
                                  borderColor: row.color.border,
                                }
                              : undefined
                          }
                        >
                          <div className="day-location-main">
                            <p className="day-location-title">
                              <strong>{row.locationLabel}</strong>
                            </p>
                            <p className="day-location-time">{row.timeLabel}</p>
                            <div className="shift-role-stats">
                              {row.roleStats.map((roleStat) => (
                                <p key={`${row.shiftId}-${roleStat.label}`} className="day-location-type">
                                  {roleStat.label}: {roleStat.assigned}/{roleStat.required}
                                </p>
                              ))}
                            </div>
                            {isBusy ? <p className="tiny subtle">Přidávám preset…</p> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="subtle">{day.emptyStateLabel}</p>
                )}
              </article>
            ))}
          </section>
        </div>

        {canManageCalendar && sidebarOpen ? (
          <aside className="panel stack calendar-sidebar desktop-only preset-sidebar">
            <div className="row between align-center">
              <div>
                <p className="eyebrow">Presety</p>
                <h3>Předpřipravené směny</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Skrýt preset panel"
                onClick={() => setSidebarOpen(false)}
              >
                <span aria-hidden>→</span>
              </button>
            </div>

            <button type="button" className="button" onClick={() => setCreateOpen(true)}>
              Vytvořit preset
            </button>

            <div className="stack gap-sm">
              {shiftPresets.length === 0 ? (
                <div className="preset-empty-card">
                  <strong>Zatím žádné presety</strong>
                  <p className="subtle tiny">Vytvoř první preset a pak ho přetáhni na konkrétní pobočku v kalendáři.</p>
                </div>
              ) : (
                shiftPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`preset-card ${activePresetId === preset.id ? "active" : ""}`.trim()}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData("text/preset", preset.id);
                      setActivePresetId(preset.id);
                    }}
                    onDragEnd={() => {
                      setActivePresetId(null);
                      setDropTarget(null);
                    }}
                  >
                    <strong>{preset.name}</strong>
                    <span className="subtle tiny">
                      {(locations.find((location) => location.id === preset.locationId)?.name ?? "Pobočka")} • {preset.startTime}–{preset.endTime}
                    </span>
                    <span className="subtle tiny">
                      {preset.requiredRoles.length > 0
                        ? preset.requiredRoles.map((item) => `${staffRoleLabels[item.role]} ${item.count}x`).join(", ")
                        : "Bez rolí"}
                    </span>
                    {preset.description ? <span className="subtle tiny">{preset.description}</span> : null}
                    <form action={deleteShiftPresetAction}>
                      <input type="hidden" name="presetId" value={preset.id} />
                      <input type="hidden" name="redirectTo" value={currentHref} />
                      <ConfirmSubmitButton
                        type="submit"
                        className="button ghost danger small"
                        confirmMessage={`Smazat preset ${preset.name}?`}
                      >
                        Smazat
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                ))
              )}
            </div>
          </aside>
        ) : null}
      </section>

      {createOpen ? (
        <div className="calendar-overlay" role="dialog" aria-modal="true" aria-label="Vytvořit preset">
          <button type="button" className="calendar-overlay-backdrop" aria-label="Zavřít preset okno" onClick={() => setCreateOpen(false)} />
          <div className="calendar-overlay-panel">
            <section className="panel stack preset-create-modal">
              <div className="row between wrap">
                <div>
                  <p className="eyebrow">Nový preset</p>
                  <h2>Vytvořit předpřipravenou směnu</h2>
                </div>
                <button type="button" className="icon-button modal-close-button" aria-label="Zavřít" onClick={() => setCreateOpen(false)}>
                  <span aria-hidden>×</span>
                </button>
              </div>

              <form action={createShiftPresetAction} className="grid-form">
                <input type="hidden" name="redirectTo" value={currentHref} />
                <label>
                  Název presetu
                  <input type="text" name="name" placeholder="Např. Víkend plac + kuchyň" required />
                </label>
                <label>
                  Typ směny
                  <select name="type" defaultValue="restaurant">
                    {SHIFT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {shiftTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Od
                  <input type="time" name="startTime" defaultValue="10:00" />
                </label>
                <label>
                  Do
                  <input type="time" name="endTime" defaultValue="22:00" />
                </label>
                <label>
                  Pobočka
                  <select name="locationId" defaultValue={locations[0]?.id ?? ""} required>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Krátký popis
                  <input type="text" name="description" placeholder="Krátce popiš preset" />
                </label>
                {STAFF_ROLES.map((role) => {
                  const enabled = enabledRoles[role] ?? false;
                  return (
                    <div key={`preset-${role}`} className="preset-role-card">
                      <label className="inline preset-role-toggle">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) =>
                            setEnabledRoles((current) => ({
                              ...current,
                              [role]: event.target.checked,
                            }))
                          }
                        />
                        Potřeba {staffRoleLabels[role]}
                      </label>
                      <input
                        type="number"
                        min={0}
                        name={`${role}Count`}
                        defaultValue={enabled ? 1 : 0}
                        disabled={!enabled}
                      />
                    </div>
                  );
                })}
                <label className="full">
                  Poznámka
                  <textarea name="notes" rows={2} placeholder="Volitelné poznámky k preset směně" />
                </label>
                <div className="row gap-sm wrap full">
                  <button type="submit" className="button">
                    Uložit preset
                  </button>
                  <button type="button" className="button ghost" onClick={() => setCreateOpen(false)}>
                    Zavřít
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
