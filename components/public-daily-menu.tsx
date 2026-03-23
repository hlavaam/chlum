"use client";

import { useEffect, useState } from "react";

import type { DailyMenuDayRecord } from "@/types/models";

type Props = {
  initialDate: string;
  initialMenu: DailyMenuDayRecord | null;
};

function formatLongDate(date: string) {
  try {
    return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "full" }).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "nyni";
  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function PublicDailyMenu({ initialDate, initialMenu }: Props) {
  const [date, setDate] = useState(initialDate);
  const [menu, setMenu] = useState(initialMenu);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (date === initialDate) {
      setMenu(initialMenu);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;

    async function loadMenu() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/daily-menu?date=${encodeURIComponent(date)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(typeof payload?.error === "string" ? payload.error : "Menu se nepodarilo nacist.");
        }
        if (!cancelled) {
          setMenu(payload.menu ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setMenu(null);
          setError(loadError instanceof Error ? loadError.message : "Menu se nepodarilo nacist.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMenu();
    return () => {
      cancelled = true;
    };
  }, [date, initialDate]);

  return (
    <article className="public-card daily-menu-card">
      <div className="daily-menu-head">
        <div>
          <p className="eyebrow">Denni nabidka</p>
          <h3>{menu?.title ?? "Denní menu"}</h3>
          <p className="public-muted">{formatLongDate(date)}</p>
        </div>
        <label className="public-date-input">
          Datum
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      <p className="daily-menu-note">
        {loading ? "Nacitam menu..." : error || menu?.note || "Na vybrane datum zatim nema denni menu zadanou nabidku."}
      </p>

      <ul className="daily-menu-items">
        {menu?.items?.length ? (
          menu.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="daily-menu-row">
              <div>
                <strong>{item.name}</strong>
                <p className="public-muted">
                  {[item.category, item.allergens ? `Alergeny: ${item.allergens}` : ""].filter(Boolean).join(" • ")}
                </p>
              </div>
              <span>{item.price || "-"}</span>
            </li>
          ))
        ) : (
          <li className="daily-menu-row empty">
            <span>Vybrane datum je bez denni nabidky.</span>
          </li>
        )}
      </ul>

      <p className="public-meta">Aktualizováno: {formatUpdatedAt(menu?.updatedAt)}</p>
    </article>
  );
}
