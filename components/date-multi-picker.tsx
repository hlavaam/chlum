"use client";

import { useState } from "react";

function toDateKey(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthGrid(anchor: Date) {
  const first = startOfMonth(anchor);
  const start = new Date(first);
  const firstWeekday = start.getDay(); // 0=Sun
  const diff = firstWeekday === 0 ? -6 : 1 - firstWeekday; // Monday first
  start.setDate(start.getDate() + diff);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

type Props = {
  name: string;
  initialDate?: string;
};

export function DateMultiPicker({ name, initialDate }: Props) {
  const [anchor, setAnchor] = useState(() => {
    const base = initialDate ? new Date(`${initialDate}T00:00:00`) : new Date();
    return Number.isNaN(base.getTime()) ? new Date() : new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string[]>([]);

  const grid = monthGrid(anchor);
  const anchorMonth = anchor.getMonth();
  const selectedSet = new Set(selected);

  function toggleDate(dateKey: string) {
    setSelected((current) => {
      if (current.includes(dateKey)) {
        return current.filter((d) => d !== dateKey);
      }
      return [...current, dateKey].sort((a, b) => a.localeCompare(b));
    });
  }

  return (
    <div className="date-picker-card">
      <input type="hidden" name={name} value={selected.join("\n")} />

      <div className="date-picker-head">
        <button
          type="button"
          className="button ghost"
          onClick={() => setAnchor((d) => addMonths(d, -1))}
        >
          ←
        </button>
        <strong>
          {new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(anchor)}
        </strong>
        <button
          type="button"
          className="button ghost"
          onClick={() => setAnchor((d) => addMonths(d, 1))}
        >
          →
        </button>
      </div>

      <div className="date-picker-weekdays">
        {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="date-picker-grid">
        {grid.map((date) => {
          const dateKey = toDateKey(date);
          const inMonth = date.getMonth() === anchorMonth;
          const active = selectedSet.has(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              className={`date-cell ${active ? "active" : ""} ${inMonth ? "" : "muted"}`}
              onClick={() => toggleDate(dateKey)}
              title={dateKey}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="row gap-sm wrap">
        <button type="button" className="button ghost" onClick={() => setSelected([])}>
          Vyčistit
        </button>
        <span className="subtle">
          Vybráno: <strong>{selected.length}</strong> dnů
        </span>
      </div>

      {selected.length > 0 ? (
        <div className="chips">
          {selected.slice(0, 12).map((dateKey) => (
            <button
              type="button"
              key={dateKey}
              className="chip chip-button"
              onClick={() => toggleDate(dateKey)}
              title="Odebrat datum"
            >
              {dateKey}
            </button>
          ))}
          {selected.length > 12 ? <span className="chip">+{selected.length - 12} dalších</span> : null}
        </div>
      ) : null}
    </div>
  );
}
