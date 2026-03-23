"use client";

import { useEffect, useState } from "react";

import type { DailyMenuDayRecord, DailyMenuItem } from "@/types/models";

type SavedDate = {
  date: string;
  title: string;
  updatedAt: string | null;
};

type StatusState = {
  message: string;
  tone: "" | "ok" | "error";
};

function toLocalDateString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function createEmptyItem(): DailyMenuItem {
  return { category: "", name: "", price: "", allergens: "" };
}

function formatLongDate(date: string) {
  try {
    return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "full" }).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}

function formatUpdatedAt(value: string | null) {
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

export function DailyMenuAdmin() {
  const today = toLocalDateString(new Date());
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("Denní menu");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DailyMenuItem[]>([createEmptyItem()]);
  const [savedDates, setSavedDates] = useState<SavedDate[]>([]);
  const [status, setStatus] = useState<StatusState>({ message: "", tone: "" });
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function refreshSavedDates() {
    const response = await fetch("/api/daily-menu/dates", { cache: "no-store" });
    const payload = await response.json();
    setSavedDates(Array.isArray(payload.dates) ? payload.dates : []);
  }

  function applyMenu(menu: DailyMenuDayRecord | null, selectedDate: string) {
    setDate(selectedDate);
    setTitle(menu?.title || "Denní menu");
    setNote(menu?.note || "");
    setItems(menu?.items?.length ? menu.items : [createEmptyItem()]);
    setUpdatedAt(menu?.updatedAt || null);
  }

  async function loadMenu(selectedDate: string, silent = false) {
    setLoading(true);
    try {
      const response = await fetch(`/api/daily-menu?date=${encodeURIComponent(selectedDate)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Menu se nepodarilo nacist.");
      }
      applyMenu(payload.menu ?? null, selectedDate);
      if (!silent) {
        setStatus({ message: `Načteno menu pro ${formatLongDate(selectedDate)}.`, tone: "ok" });
      }
    } catch (error) {
      applyMenu(null, selectedDate);
      setStatus({
        message: error instanceof Error ? error.message : "Menu se nepodarilo nacist.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadMenu(today, true), refreshSavedDates()]);
  }, [today]);

  function updateItem(index: number, key: keyof DailyMenuItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function addRow() {
    setItems((current) => [...current, createEmptyItem()]);
  }

  function removeRow(index: number) {
    setItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [createEmptyItem()];
    });
  }

  async function saveMenu() {
    setLoading(true);
    setStatus({ message: "", tone: "" });
    try {
      const response = await fetch(`/api/daily-menu?date=${encodeURIComponent(date)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, note, items }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Menu se nepodarilo ulozit.");
      }
      applyMenu(payload.menu ?? null, date);
      await refreshSavedDates();
      setStatus({ message: "Menu bylo uloženo a je hned vidět na webu.", tone: "ok" });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Menu se nepodarilo ulozit.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function deleteMenu() {
    setLoading(true);
    setStatus({ message: "", tone: "" });
    try {
      const response = await fetch(`/api/daily-menu?date=${encodeURIComponent(date)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Menu se nepodarilo smazat.");
      }
      applyMenu(null, date);
      await refreshSavedDates();
      setStatus({ message: `Menu pro ${formatLongDate(date)} bylo smazáno.`, tone: "ok" });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Menu se nepodarilo smazat.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="menu-admin-layout">
      <section className="panel stack">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Denní provoz restaurace</p>
            <h2>Správa denního menu</h2>
            <p className="subtle">Upravené menu se okamžitě propíše na veřejný web restaurace.</p>
          </div>
          <div className="row gap-sm wrap">
            <button type="button" className="button ghost" onClick={addRow}>
              Přidat položku
            </button>
            <button type="button" className="button" onClick={saveMenu} disabled={loading}>
              {loading ? "Ukládám..." : "Uložit menu"}
            </button>
            <button type="button" className="button ghost danger" onClick={deleteMenu} disabled={loading}>
              Smazat den
            </button>
          </div>
        </div>

        <div className="grid-form">
          <label>
            Datum menu
            <input
              type="date"
              value={date}
              onChange={(event) => {
                const selectedDate = event.target.value;
                setDate(selectedDate);
                void loadMenu(selectedDate, true);
              }}
              required
            />
          </label>
          <label>
            Nadpis
            <input type="text" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="full">
            Poznámka
            <textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>

        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th>Název jídla</th>
                <th>Cena</th>
                <th>Alergeny</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${index}-${item.name}`}>
                  <td data-label="Kategorie">
                    <input
                      type="text"
                      value={item.category}
                      maxLength={60}
                      onChange={(event) => updateItem(index, "category", event.target.value)}
                    />
                  </td>
                  <td data-label="Název">
                    <input
                      type="text"
                      value={item.name}
                      maxLength={160}
                      onChange={(event) => updateItem(index, "name", event.target.value)}
                    />
                  </td>
                  <td data-label="Cena">
                    <input
                      type="text"
                      value={item.price}
                      maxLength={50}
                      onChange={(event) => updateItem(index, "price", event.target.value)}
                    />
                  </td>
                  <td data-label="Alergeny">
                    <input
                      type="text"
                      value={item.allergens}
                      maxLength={80}
                      onChange={(event) => updateItem(index, "allergens", event.target.value)}
                    />
                  </td>
                  <td data-label="Akce">
                    <button type="button" className="button ghost danger small" onClick={() => removeRow(index)}>
                      Smazat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {status.message ? <p className={`admin-status ${status.tone}`.trim()}>{status.message}</p> : null}
      </section>

      <section className="stack gap-lg">
        <article className="panel stack">
          <h3>Uložené dny</h3>
          <div className="saved-date-list">
            {savedDates.length ? (
              savedDates.map((entry) => (
                <button
                  key={entry.date}
                  type="button"
                  className={`saved-date-btn ${entry.date === date ? "active" : ""}`.trim()}
                  onClick={() => void loadMenu(entry.date)}
                >
                  <strong>{entry.date}</strong>
                  <span>{entry.title}</span>
                </button>
              ))
            ) : (
              <p className="subtle">Zatím není uložený žádný den.</p>
            )}
          </div>
        </article>

        <article className="panel stack">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Náhled tisku</p>
              <h3>{title || "Denní menu"}</h3>
            </div>
            <p className="subtle">{formatLongDate(date)}</p>
          </div>
          <p className="subtle">{note || "Bez doplňující poznámky."}</p>
          <ul className="daily-menu-items">
            {items.filter((item) => item.name.trim()).length ? (
              items
                .filter((item) => item.name.trim())
                .map((item, index) => (
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
                <span>Zatím nejsou vyplněné žádné položky.</span>
              </li>
            )}
          </ul>
          <p className="subtle tiny">Poslední úprava: {formatUpdatedAt(updatedAt)}</p>
        </article>
      </section>
    </div>
  );
}
