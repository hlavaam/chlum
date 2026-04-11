"use client";

import { useEffect, useState } from "react";

import { MENU_CATEGORY_OPTIONS } from "@/lib/daily-menu-presets";
import type { DailyDrinkItem, DailyMenuDayRecord, DailyMenuItem } from "@/types/models";

type SavedDate = {
  date: string;
  title: string;
  updatedAt: string | null;
  isPublished: boolean;
};

type StatusState = {
  message: string;
  tone: "" | "ok" | "error";
};

type EditorMenuItem = DailyMenuItem & {
  id: string;
};

type EditorDrinkItem = DailyDrinkItem & {
  id: string;
};

type MenuCategoryValue = (typeof MENU_CATEGORY_OPTIONS)[number]["value"];

const DEFAULT_CATEGORY: MenuCategoryValue = "Hlavni chod";

const CATEGORY_SECTION_LABELS: Record<MenuCategoryValue, string> = {
  Polevka: "Polévky",
  Predkrm: "Předkrmy",
  "Hlavni chod": "Hlavní jídla",
  Dezert: "Dezerty",
};

function toLocalDateString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function createItemId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `menu-item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isKnownCategory(category: string): category is MenuCategoryValue {
  return MENU_CATEGORY_OPTIONS.some((option) => option.value === category);
}

function normalizeCategory(category: string | undefined) {
  return category && isKnownCategory(category) ? category : DEFAULT_CATEGORY;
}

function normalizePrice(value: string | undefined) {
  return (value ?? "").replace(/\s*(kč|kc)\s*$/i, "").trim();
}

function formatPrice(value: string | undefined) {
  const normalized = normalizePrice(value);
  return normalized ? `${normalized} Kč` : "-";
}

function createEditorItem(partial: Partial<DailyMenuItem> = {}): EditorMenuItem {
  return {
    id: createItemId(),
    category: normalizeCategory(partial.category),
    name: partial.name ?? "",
    price: normalizePrice(partial.price),
    allergens: partial.allergens ?? "",
  };
}

function createEditorDrink(partial: Partial<DailyDrinkItem> = {}): EditorDrinkItem {
  return {
    id: createItemId(),
    name: partial.name ?? "",
    description: partial.description ?? "",
    price: normalizePrice(partial.price),
  };
}

function toEditorItems(items: DailyMenuItem[] | undefined) {
  if (!items?.length) {
    return [createEditorItem()];
  }

  return items.map((item) => createEditorItem(item));
}

function toEditorDrinks(items: DailyDrinkItem[] | undefined) {
  if (!items?.length) {
    return [createEditorDrink()];
  }

  return items.map((item) => createEditorDrink(item));
}

function toStoredItems(items: EditorMenuItem[]): DailyMenuItem[] {
  return items.map(({ id: _id, ...item }) => ({ ...item, price: normalizePrice(item.price) }));
}

function toStoredDrinks(items: EditorDrinkItem[]): DailyDrinkItem[] {
  return items
    .map(({ id: _id, ...item }) => ({ ...item, price: normalizePrice(item.price) }))
    .filter((item) => item.name.trim());
}

function formatLongDate(date: string) {
  try {
    return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "full" }).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "zatím neuloženo";
  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getFilledItems(items: EditorMenuItem[]) {
  return items.filter((item) => item.name.trim());
}

function getFilledDrinks(items: EditorDrinkItem[]) {
  return items.filter((item) => item.name.trim());
}

function getGroupedItems(items: EditorMenuItem[]) {
  const filledItems = getFilledItems(items);

  return MENU_CATEGORY_OPTIONS.map((category) => ({
    category: category.value,
    label: CATEGORY_SECTION_LABELS[category.value],
    items: filledItems.filter((item) => item.category === category.value),
  })).filter((group) => group.items.length > 0);
}

function getBookletBubbles({
  title,
  date,
  note,
  foodCount,
  drinkCount,
}: {
  title: string;
  date: string;
  note: string;
  foodCount: number;
  drinkCount: number;
}) {
  const bubbles = [
    { label: "Datum", value: formatLongDate(date) },
    { label: "Uvnitř", value: "Nápoje vlevo, jídla vpravo." },
    { label: "Rozsah", value: `${foodCount} jídel a ${drinkCount} nápojů.` },
    { label: "Formát", value: "Oboustranná A4, po přeložení A5." },
  ];

  if (title.trim() && title.trim() !== "Denní menu") {
    bubbles.unshift({ label: "Titulek", value: title.trim() });
  }

  if (note.trim()) {
    bubbles.push({ label: "Poznámka", value: note.trim() });
  }

  return bubbles;
}

function renderFoodSectionsHtml(groupedItems: ReturnType<typeof getGroupedItems>) {
  if (!groupedItems.length) {
    return `<p class="booklet-empty">V menu zatím nejsou vyplněné žádné položky.</p>`;
  }

  return groupedItems
    .map(
      (group) => `
        <section class="booklet-section">
          <div class="booklet-section-title">${escapeHtml(group.label)}</div>
          <div class="booklet-section-items">
            ${group.items
              .map(
                (item) => `
                  <article class="booklet-row">
                    <div class="booklet-row-main">
                      <h4>${escapeHtml(item.name)}</h4>
                      ${item.allergens ? `<p>Alergeny: ${escapeHtml(item.allergens)}</p>` : ""}
                    </div>
                    <strong>${escapeHtml(formatPrice(item.price))}</strong>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function renderDrinkRowsHtml(drinks: EditorDrinkItem[]) {
  if (!drinks.length) {
    return `<p class="booklet-empty">Nápoje zatím nejsou vyplněné.</p>`;
  }

  return drinks
    .map(
      (drink) => `
        <article class="booklet-row drink">
          <div class="booklet-row-main">
            <h4>${escapeHtml(drink.name)}</h4>
            ${drink.description ? `<p>${escapeHtml(drink.description)}</p>` : ""}
          </div>
          <strong>${escapeHtml(formatPrice(drink.price))}</strong>
        </article>
      `,
    )
    .join("");
}

function buildPrintDocument({
  title,
  date,
  note,
  items,
  drinks,
  logoUrl,
}: {
  title: string;
  date: string;
  note: string;
  items: EditorMenuItem[];
  drinks: EditorDrinkItem[];
  logoUrl: string;
}) {
  const groups = getGroupedItems(items);
  const filledDrinks = getFilledDrinks(drinks);
  const bubbles = getBookletBubbles({
    title,
    date,
    note,
    foodCount: items.length,
    drinkCount: filledDrinks.length,
  });
  const foodContent = renderFoodSectionsHtml(groups);
  const drinkContent = renderDrinkRowsHtml(filledDrinks);

  return `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} | ${escapeHtml(date)}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #efe5d4;
        color: #1f221c;
        font-family: "Montserrat", "Segoe UI", sans-serif;
      }

      img {
        display: block;
        max-width: 100%;
      }

      .booklet {
        display: grid;
        gap: 0;
      }

      .spread {
        width: 210mm;
        min-height: 297mm;
        display: flex;
        gap: 8mm;
        padding: 10mm;
        break-after: page;
        page-break-after: always;
      }

      .spread:last-child {
        break-after: auto;
        page-break-after: auto;
      }

      .booklet-panel {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: calc(297mm - 20mm);
        padding: 9mm 8mm;
        border-radius: 9mm;
        background:
          radial-gradient(circle at top right, rgba(188, 124, 59, 0.16), transparent 30%),
          linear-gradient(180deg, #fffaf2 0%, #f6efdf 100%);
        border: 0.35mm solid rgba(63, 52, 31, 0.08);
      }

      .cover-panel {
        justify-content: space-between;
      }

      .cover-top {
        display: grid;
        gap: 8mm;
      }

      .cover-logo {
        width: 52mm;
      }

      .cover-brand {
        font-size: 10pt;
        font-weight: 800;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #7c684b;
      }

      .cover-title {
        margin: 0;
        font-size: 30pt;
        line-height: 0.9;
        letter-spacing: -0.05em;
        font-weight: 800;
      }

      .cover-subtitle {
        margin: 0;
        font-size: 13pt;
        color: #615748;
        line-height: 1.35;
      }

      .cover-date {
        display: inline-flex;
        width: fit-content;
        padding: 4mm 5mm;
        border-radius: 999px;
        background: rgba(47, 93, 35, 0.1);
        color: #1d5b4d;
        font-size: 10.5pt;
        font-weight: 800;
      }

      .info-panel {
        background:
          radial-gradient(circle at top left, rgba(47, 93, 35, 0.14), transparent 22%),
          linear-gradient(180deg, #faf5eb 0%, #f2e8d8 100%);
      }

      .panel-heading {
        display: grid;
        gap: 3mm;
        margin-bottom: 8mm;
      }

      .panel-heading span {
        font-size: 9.5pt;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #7c684b;
        font-weight: 800;
      }

      .panel-heading h2 {
        margin: 0;
        font-size: 20pt;
        line-height: 0.95;
        letter-spacing: -0.04em;
      }

      .bubble-list {
        display: grid;
        gap: 4mm;
      }

      .bubble {
        padding: 5mm;
        border-radius: 6mm;
        background: rgba(255, 255, 255, 0.68);
        border: 0.35mm solid rgba(63, 52, 31, 0.08);
      }

      .bubble-label {
        display: block;
        margin-bottom: 2mm;
        font-size: 8.5pt;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #2f5d23;
      }

      .bubble p {
        margin: 0;
        font-size: 10.5pt;
        line-height: 1.45;
        color: #584f42;
      }

      .content-panel {
        gap: 5mm;
      }

      .content-body {
        display: grid;
        gap: 4mm;
        align-content: start;
      }

      .booklet-section {
        padding: 4.2mm 4.5mm;
        border-radius: 5mm;
        background: rgba(255, 255, 255, 0.72);
        border: 0.35mm solid rgba(63, 52, 31, 0.08);
      }

      .booklet-section-title {
        display: inline-flex;
        margin-bottom: 3mm;
        padding: 2mm 3mm;
        border-radius: 999px;
        background: rgba(47, 93, 35, 0.12);
        color: #2f5d23;
        font-size: 8.2pt;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .booklet-section-items {
        display: grid;
        gap: 3mm;
      }

      .booklet-row {
        display: flex;
        justify-content: space-between;
        gap: 4mm;
        align-items: flex-start;
        padding-top: 3mm;
        border-top: 0.35mm dashed rgba(63, 52, 31, 0.12);
      }

      .booklet-row:first-child {
        padding-top: 0;
        border-top: none;
      }

      .booklet-row-main h4 {
        margin: 0;
        font-size: 10.5pt;
        line-height: 1.3;
      }

      .booklet-row-main p {
        margin: 1.6mm 0 0;
        color: #6f6656;
        font-size: 8.8pt;
        line-height: 1.4;
      }

      .booklet-row strong {
        white-space: nowrap;
        font-size: 10.5pt;
        font-weight: 800;
      }

      .booklet-empty {
        margin: 0;
        padding: 5mm;
        border-radius: 5mm;
        border: 0.35mm dashed rgba(63, 52, 31, 0.12);
        color: #6f6656;
        font-size: 10pt;
      }

      @media screen {
        body {
          padding: 10mm;
        }
      }

      @media print {
        body {
          background: transparent;
        }
      }
    </style>
  </head>
  <body>
    <main class="booklet">
      <section class="spread">
        <article class="booklet-panel cover-panel">
          <div class="cover-top">
            <img class="cover-logo" src="${escapeHtml(logoUrl)}" alt="Restaurace Vyskeř" />
            <div class="cover-brand">Restaurace Vyskeř</div>
            <div>
              <h1 class="cover-title">Jídelní<br />lístek</h1>
              <p class="cover-subtitle">${escapeHtml(title || "Denní menu")}</p>
            </div>
          </div>
          <div class="cover-date">${escapeHtml(formatLongDate(date))}</div>
        </article>

        <article class="booklet-panel info-panel">
          <div class="panel-heading">
            <span>První strana</span>
            <h2>Info a poznámky</h2>
          </div>
          <div class="bubble-list">
            ${bubbles
              .map(
                (bubble) => `
                  <article class="bubble">
                    <span class="bubble-label">${escapeHtml(bubble.label)}</span>
                    <p>${escapeHtml(bubble.value)}</p>
                  </article>
                `,
              )
              .join("")}
          </div>
        </article>
      </section>

      <section class="spread">
        <article class="booklet-panel content-panel">
          <div class="panel-heading">
            <span>Levá vnitřní strana</span>
            <h2>Nápoje</h2>
          </div>
          <div class="content-body">
            ${drinkContent}
          </div>
        </article>

        <article class="booklet-panel content-panel">
          <div class="panel-heading">
            <span>Pravá vnitřní strana</span>
            <h2>Jídla</h2>
          </div>
          <div class="content-body">
            ${foodContent}
          </div>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

function getInsertIndexForCategory(items: EditorMenuItem[], category: MenuCategoryValue) {
  const lastInCategoryIndex = items.reduce((lastIndex, item, index) => {
    if (item.category === category) {
      return index;
    }

    return lastIndex;
  }, -1);

  if (lastInCategoryIndex >= 0) {
    return lastInCategoryIndex + 1;
  }

  const categoryOrder = MENU_CATEGORY_OPTIONS.map((option) => option.value);
  const currentCategoryIndex = categoryOrder.indexOf(category);

  for (let index = currentCategoryIndex + 1; index < categoryOrder.length; index += 1) {
    const nextCategory = categoryOrder[index];
    const laterCategoryIndex = items.findIndex((item) => item.category === nextCategory);
    if (laterCategoryIndex >= 0) {
      return laterCategoryIndex;
    }
  }

  return items.length;
}

function renderPreviewSheet({
  title,
  date,
  note,
  groupedPreview,
  drinksPreview,
}: {
  title: string;
  date: string;
  note: string;
  groupedPreview: ReturnType<typeof getGroupedItems>;
  drinksPreview: EditorDrinkItem[];
}) {
  const bubbles = getBookletBubbles({
    title,
    date,
    note,
    foodCount: groupedPreview.reduce((count, group) => count + group.items.length, 0),
    drinkCount: drinksPreview.length,
  });

  return (
    <div className="menu-booklet-sheet">
      <div className="menu-booklet-page">
        <article className="menu-booklet-panel menu-booklet-cover">
          <div className="menu-booklet-cover-top">
            <img className="menu-booklet-logo" src="/hero/vyskerlogo.png" alt="Restaurace Vyskeř" />
            <p className="menu-booklet-brand">Restaurace Vyskeř</p>
            <div className="stack gap-sm">
              <h3>Jídelní lístek</h3>
              <p className="subtle">{title || "Denní menu"}</p>
            </div>
          </div>
          <div className="menu-booklet-date">{formatLongDate(date)}</div>
        </article>

        <article className="menu-booklet-panel menu-booklet-info">
          <div className="stack">
            <p className="menu-booklet-section-kicker">První strana</p>
            <h3>Info a bubliny</h3>
          </div>
          <div className="menu-booklet-bubbles">
            {bubbles.map((bubble) => (
              <article key={`${bubble.label}-${bubble.value}`} className="menu-booklet-bubble">
                <span>{bubble.label}</span>
                <p>{bubble.value}</p>
              </article>
            ))}
          </div>
        </article>
      </div>

      <div className="menu-booklet-page">
        <article className="menu-booklet-panel">
          <div className="stack">
            <p className="menu-booklet-section-kicker">Levá vnitřní strana</p>
            <h3>Nápoje</h3>
          </div>
          <div className="menu-booklet-content">
            {drinksPreview.length ? (
              drinksPreview.map((drink) => (
                <div key={drink.id} className="menu-booklet-row">
                  <div>
                    <strong>{drink.name}</strong>
                    {drink.description ? <p className="subtle tiny">{drink.description}</p> : null}
                  </div>
                  <span>{formatPrice(drink.price)}</span>
                </div>
              ))
            ) : (
              <p className="subtle">Nápoje se doplní sem.</p>
            )}
          </div>
        </article>

        <article className="menu-booklet-panel">
          <div className="stack">
            <p className="menu-booklet-section-kicker">Pravá vnitřní strana</p>
            <h3>Jídla</h3>
          </div>
          <div className="menu-booklet-content">
            {groupedPreview.length ? (
              groupedPreview.map((group) => (
                <section key={group.category} className="menu-booklet-group">
                  <div className="menu-booklet-group-title">{group.label}</div>
                  <div className="stack gap-sm">
                    {group.items.map((item) => (
                      <div key={item.id} className="menu-booklet-row">
                        <div>
                          <strong>{item.name}</strong>
                          {item.allergens ? <p className="subtle tiny">Alergeny: {item.allergens}</p> : null}
                        </div>
                        <span>{formatPrice(item.price)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <p className="subtle">Náhled se ukáže, jakmile vyplníš první jídlo.</p>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

export function DailyMenuAdmin() {
  const today = toLocalDateString(new Date());
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("Denní menu");
  const [note, setNote] = useState("Menu podáváme do vyprodání.");
  const [items, setItems] = useState<EditorMenuItem[]>([createEditorItem()]);
  const [drinks, setDrinks] = useState<EditorDrinkItem[]>([createEditorDrink()]);
  const [savedDates, setSavedDates] = useState<SavedDate[]>([]);
  const [status, setStatus] = useState<StatusState>({ message: "", tone: "" });
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropCategory, setDropCategory] = useState<MenuCategoryValue | null>(null);
  const [dropItemId, setDropItemId] = useState<string | null>(null);

  async function refreshSavedDates() {
    const response = await fetch("/api/daily-menu/dates", { cache: "no-store" });
    const payload = await response.json();
    const nextDates = Array.isArray(payload.dates) ? payload.dates : [];
    setSavedDates(nextDates);
    return nextDates as SavedDate[];
  }

  async function fetchMenu(dateValue: string) {
    const response = await fetch(`/api/daily-menu?date=${encodeURIComponent(dateValue)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(typeof payload?.error === "string" ? payload.error : "Menu se nepodařilo načíst.");
    }
    return (payload.menu ?? null) as DailyMenuDayRecord | null;
  }

  function applyMenu(menu: DailyMenuDayRecord | null, selectedDate: string, nextUpdatedAt?: string | null) {
    setDate(selectedDate);
    setTitle(menu?.title || "Denní menu");
    setNote(menu?.note || "Menu podáváme do vyprodání.");
    setItems(toEditorItems(menu?.items));
    setDrinks(toEditorDrinks(menu?.drinks));
    setIsPublished(menu?.isPublished === true);
    setUpdatedAt(nextUpdatedAt ?? menu?.updatedAt ?? null);
  }

  function findPreviousSavedDate(selectedDate: string, availableDates: SavedDate[]) {
    return availableDates.find((entry) => entry.date < selectedDate)?.date ?? null;
  }

  async function loadMenu(selectedDate: string, options?: { silent?: boolean; availableDates?: SavedDate[] }) {
    setLoading(true);
    try {
      const menu = await fetchMenu(selectedDate);
      if (menu) {
        applyMenu(menu, selectedDate);
        if (!options?.silent) {
          setStatus({ message: `Načteno menu pro ${formatLongDate(selectedDate)}.`, tone: "ok" });
        }
        return;
      }

      const previousDate = findPreviousSavedDate(selectedDate, options?.availableDates ?? savedDates);
      if (previousDate) {
        const template = await fetchMenu(previousDate);
        if (template) {
          applyMenu(template, selectedDate, null);
          setStatus({
            message: `Pro ${formatLongDate(selectedDate)} ještě není uložené menu. Jako předlohu jsem načetl ${formatLongDate(previousDate)}.`,
            tone: "ok",
          });
          return;
        }
      }

      applyMenu(null, selectedDate, null);
      if (!options?.silent) {
        setStatus({ message: `Pro ${formatLongDate(selectedDate)} zatím není žádné menu.`, tone: "ok" });
      }
    } catch (error) {
      applyMenu(null, selectedDate, null);
      setStatus({
        message: error instanceof Error ? error.message : "Menu se nepodařilo načíst.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      const dates = await refreshSavedDates();
      await loadMenu(today, { silent: true, availableDates: dates });
    }

    void initialize();
  }, [today]);

  useEffect(() => {
    if (!previewOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  function updateItem(itemId: string, key: keyof DailyMenuItem, value: string) {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, [key]: value } : item)));
  }

  function addRow(category: MenuCategoryValue) {
    setItems((current) => {
      const next = [...current];
      next.splice(getInsertIndexForCategory(current, category), 0, createEditorItem({ category }));
      return next;
    });
  }

  function updateDrink(drinkId: string, key: keyof DailyDrinkItem, value: string) {
    setDrinks((current) => current.map((item) => (item.id === drinkId ? { ...item, [key]: value } : item)));
  }

  function addDrink() {
    setDrinks((current) => [...current, createEditorDrink()]);
  }

  function removeDrink(drinkId: string) {
    setDrinks((current) => {
      const next = current.filter((item) => item.id !== drinkId);
      return next.length ? next : [createEditorDrink()];
    });
  }

  function removeRow(itemId: string) {
    setItems((current) => {
      const next = current.filter((item) => item.id !== itemId);
      return next.length ? next : [createEditorItem()];
    });
  }

  function resetDraggingState() {
    setDraggedItemId(null);
    setDropCategory(null);
    setDropItemId(null);
  }

  function moveItemToTarget(targetCategory: MenuCategoryValue, targetItemId: string | null) {
    if (!draggedItemId) {
      return;
    }

    setItems((current) => {
      const draggedItem = current.find((item) => item.id === draggedItemId);
      if (!draggedItem) {
        return current;
      }

      const withoutDragged = current.filter((item) => item.id !== draggedItemId);
      const movedItem = { ...draggedItem, category: targetCategory };
      const next = [...withoutDragged];

      const insertIndex =
        targetItemId !== null
          ? next.findIndex((item) => item.id === targetItemId)
          : getInsertIndexForCategory(next, targetCategory);

      next.splice(insertIndex >= 0 ? insertIndex : next.length, 0, movedItem);
      return next;
    });

    resetDraggingState();
  }

  async function saveMenu() {
    setLoading(true);
    setStatus({ message: "", tone: "" });
    try {
      const response = await fetch(`/api/daily-menu?date=${encodeURIComponent(date)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, note, items: toStoredItems(items), drinks: toStoredDrinks(drinks), isPublished }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Menu se nepodařilo uložit.");
      }
      applyMenu(payload.menu ?? null, date);
      await refreshSavedDates();
      setStatus({ message: "Menu bylo uloženo a je připravené pro web i tisk.", tone: "ok" });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Menu se nepodařilo uložit.",
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
        throw new Error(typeof payload?.error === "string" ? payload.error : "Menu se nepodařilo smazat.");
      }
      const nextDates = await refreshSavedDates();
      applyMenu(null, date, null);
      setStatus({ message: `Menu pro ${formatLongDate(date)} bylo smazáno.`, tone: "ok" });
      if (nextDates.length > 0) {
        await loadMenu(date, { silent: true, availableDates: nextDates });
      }
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Menu se nepodařilo smazat.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyPreviousDay() {
    const previousDate = findPreviousSavedDate(date, savedDates);
    if (!previousDate) {
      setStatus({ message: "Není z čeho kopírovat. Nejprve ulož aspoň jeden předchozí den.", tone: "error" });
      return;
    }

    setLoading(true);
    try {
      const template = await fetchMenu(previousDate);
      if (!template) {
        throw new Error("Předchozí den nemá uložené menu.");
      }
      applyMenu(template, date, null);
      setStatus({
        message: `Jako předlohu jsem použil menu z ${formatLongDate(previousDate)}.`,
        tone: "ok",
      });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Předlohu se nepodařilo načíst.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function publishSavedDate(selectedDate: string) {
    setLoading(true);
    setStatus({ message: "", tone: "" });
    try {
      const menu = await fetchMenu(selectedDate);
      if (!menu) {
        throw new Error("Vybraný den nemá uložené menu.");
      }

      const response = await fetch(`/api/daily-menu?date=${encodeURIComponent(selectedDate)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: menu.title,
          note: menu.note,
          items: menu.items,
          drinks: menu.drinks ?? [],
          isPublished: true,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Menu se nepodařilo zveřejnit.");
      }

      await refreshSavedDates();
      setIsPublished(selectedDate === date);
      setStatus({ message: `Menu pro ${formatLongDate(selectedDate)} je teď zveřejněné na webu.`, tone: "ok" });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Menu se nepodařilo zveřejnit.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  function printMenu() {
    const filledItems = getFilledItems(items);
    if (filledItems.length === 0) {
      setStatus({ message: "Nejdřív vyplň aspoň jedno jídlo, pak má tisk smysl.", tone: "error" });
      return;
    }

    const popup = window.open("", "_blank", "width=1400,height=1000");
    if (!popup) {
      setStatus({ message: "Pro tisk je potřeba povolit otevření nového okna.", tone: "error" });
      return;
    }

    popup.document.open();
    popup.document.write(
      buildPrintDocument({
        title,
        date,
        note,
        items: filledItems,
        drinks: getFilledDrinks(drinks),
        logoUrl: `${window.location.origin}/hero/vyskerlogo.png`,
      }),
    );
    popup.document.close();
    popup.focus();
    window.setTimeout(() => {
      popup.print();
    }, 250);
  }

  const groupedPreview = getGroupedItems(items);
  const drinksPreview = getFilledDrinks(drinks);

  return (
    <div className="stack gap-lg">
      <section className="panel stack menu-admin-header">
        <div className="row between wrap gap-sm">
          <div className="stack">
            <p className="eyebrow">Admin / Denní menu</p>
            <h1>Editor jídeláku</h1>
            <p className="subtle">
              Export je teď dělaný jako oboustranná A4. První strana je titulka s bublinami, po přeložení vznikne A5 knížka.
            </p>
          </div>
          <div className="row gap-sm wrap">
            <button type="button" className="button ghost" onClick={copyPreviousDay} disabled={loading}>
              Použít minulý den
            </button>
            <button type="button" className="button" onClick={saveMenu} disabled={loading}>
              {loading ? "Ukládám..." : "Uložit menu"}
            </button>
          </div>
        </div>

        <div className="grid-form">
          <label>
            Datum menu
            <input
              type="date"
              value={date}
              onChange={(event) => void loadMenu(event.target.value, { silent: true })}
              required
            />
          </label>
          <label>
            Název jídeláku
            <input type="text" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Tiskový layout
            <input type="text" value="Oboustranná A4 / po přeložení A5" readOnly />
          </label>
          <label className="menu-publish-toggle">
            <span>Zveřejnění na webu</span>
            <div className="row gap-sm">
              <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
              <span className="subtle">{isPublished ? "Tento den je právě zveřejněný." : "Na webu je jiný den nebo nic."}</span>
            </div>
          </label>
          <label className="full">
            Poznámka pod nadpis
            <textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>

        <div className="row between wrap gap-sm">
          <p className="subtle tiny">Poslední úprava: {formatUpdatedAt(updatedAt)}</p>
          <div className="row gap-sm wrap">
            <button type="button" className="button ghost" onClick={() => setPreviewOpen(true)}>
              Otevřít náhled
            </button>
            <button type="button" className="button ghost" onClick={printMenu}>
              Export do PDF
            </button>
            <button type="button" className="button ghost danger" onClick={deleteMenu} disabled={loading}>
              Smazat den
            </button>
          </div>
        </div>

        {status.message ? <p className={`admin-status ${status.tone}`.trim()}>{status.message}</p> : null}
      </section>

      <div className="menu-admin-top-grid">
        <article className="panel stack">
          <div className="row between wrap gap-sm">
            <div className="stack">
              <p className="eyebrow">Uložené dny</p>
              <h2>Historie menu</h2>
            </div>
            <button type="button" className="button ghost small" onClick={() => void refreshSavedDates()}>
              Obnovit
            </button>
          </div>
          <div className="saved-date-list">
            {savedDates.length ? (
              savedDates.map((entry) => (
                <div key={entry.date} className={`saved-date-btn ${entry.date === date ? "active" : ""}`.trim()}>
                  <button type="button" className="saved-date-main" onClick={() => void loadMenu(entry.date)}>
                    <strong>{formatLongDate(entry.date)}</strong>
                    <span>{entry.title}</span>
                  </button>
                  <div className="row between gap-sm wrap">
                    <span className={`saved-date-status ${entry.isPublished ? "live" : ""}`.trim()}>
                      {entry.isPublished ? "Zveřejněno" : "Nezveřejněno"}
                    </span>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => void publishSavedDate(entry.date)}
                      disabled={loading}
                    >
                      Zveřejnit
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="subtle">Zatím není uložený žádný den.</p>
            )}
          </div>
        </article>

        <article className="panel stack menu-admin-side-card">
          <div className="row between wrap gap-sm">
            <div className="stack">
              <p className="eyebrow">Náhled a tisk</p>
              <h2>A4 booklet</h2>
            </div>
            <span className="menu-current-count">A4/A5</span>
          </div>
          <p className="subtle">Náhled ukazuje obě tiskové strany. Levý panel je po přeložení přední strana, druhá A4 je vnitřek.</p>
          <div className="stack gap-sm">
            <button type="button" className="button" onClick={() => setPreviewOpen(true)}>
              Zobrazit náhled
            </button>
            <button type="button" className="button ghost" onClick={printMenu}>
              Export do PDF
            </button>
          </div>
        </article>
      </div>

      <section className="panel stack menu-current-panel">
          <div className="row between wrap gap-sm">
            <div className="stack">
            <p className="eyebrow">Aktuální jídelák</p>
            <h2>{title || "Denní menu"}</h2>
            <p className="subtle">{formatLongDate(date)}</p>
          </div>
            <p className="menu-current-count">{getFilledItems(items).length} jídel / {toStoredDrinks(drinks).length} nápojů</p>
          </div>

          <div className="menu-category-list">
            {MENU_CATEGORY_OPTIONS.map((category) => {
              const sectionItems = items.filter((item) => item.category === category.value);
              const isDropTarget = dropCategory === category.value && dropItemId === null;

              return (
                <section key={category.value} className="menu-category-section">
                  <div className="menu-category-head">
                    <div className="stack">
                      <p className="eyebrow">{CATEGORY_SECTION_LABELS[category.value]}</p>
                      <p className="subtle tiny">{sectionItems.length} řádků</p>
                    </div>
                  </div>

                  <div className="menu-category-rows">
                    {sectionItems.length ? (
                      sectionItems.map((item) => (
                        <article
                          key={item.id}
                          className={`menu-line-item ${
                            draggedItemId === item.id ? "dragging" : ""
                          } ${dropCategory === category.value && dropItemId === item.id ? "drop-target" : ""}`.trim()}
                          draggable
                          onDragStart={() => {
                            setDraggedItemId(item.id);
                            setDropCategory(category.value);
                            setDropItemId(item.id);
                          }}
                          onDragEnd={resetDraggingState}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDropCategory(category.value);
                            setDropItemId(item.id);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            moveItemToTarget(category.value, item.id);
                          }}
                        >
                          <div className="menu-line-drag" aria-hidden="true">
                            <span />
                            <span />
                          </div>

                          <div className="menu-line-fields">
                            <label className="menu-line-name">
                              Jídlo
                              <input
                                type="text"
                                value={item.name}
                                maxLength={160}
                                onChange={(event) => updateItem(item.id, "name", event.target.value)}
                                placeholder="Např. Svíčková na smetaně, houskový knedlík"
                              />
                            </label>
                            <label>
                              Cena
                              <div className="menu-line-price-field">
                                <input
                                  type="text"
                                  value={item.price}
                                  inputMode="numeric"
                                  maxLength={50}
                                  onChange={(event) => updateItem(item.id, "price", normalizePrice(event.target.value))}
                                  placeholder="229"
                                />
                                <span className="menu-line-suffix">Kč</span>
                              </div>
                            </label>
                            <label>
                              Alergeny
                              <input
                                type="text"
                                value={item.allergens}
                                maxLength={80}
                                onChange={(event) => updateItem(item.id, "allergens", event.target.value)}
                                placeholder="1,3,7"
                              />
                            </label>
                          </div>

                          <button type="button" className="button ghost danger small" onClick={() => removeRow(item.id)}>
                            Smazat
                          </button>
                        </article>
                      ))
                    ) : (
                      <div className="menu-category-empty">Zatím tu není žádné jídlo.</div>
                    )}

                    <div
                      className={`menu-category-dropzone ${isDropTarget ? "active" : ""}`.trim()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropCategory(category.value);
                        setDropItemId(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        moveItemToTarget(category.value, null);
                      }}
                    >
                      {draggedItemId ? "Pustit sem jako poslední v sekci" : " "}
                    </div>

                    <button type="button" className="button ghost menu-category-add" onClick={() => addRow(category.value)}>
                      Přidat jídlo
                    </button>
                  </div>
                </section>
              );
            })}
          </div>

          <section className="menu-category-section">
            <div className="menu-category-head">
              <div className="stack">
                <p className="eyebrow">Nápoje</p>
                <p className="subtle tiny">{toStoredDrinks(drinks).length} řádků</p>
              </div>
            </div>

            <div className="menu-category-rows">
              {drinks.length ? (
                drinks.map((drink) => (
                  <article key={drink.id} className="menu-line-item menu-drink-item">
                    <div className="menu-line-fields menu-drink-fields">
                      <label className="menu-line-name">
                        Nápoj
                        <input
                          type="text"
                          value={drink.name}
                          maxLength={120}
                          onChange={(event) => updateDrink(drink.id, "name", event.target.value)}
                          placeholder="Např. Domácí limonáda"
                        />
                      </label>
                      <label className="menu-line-name">
                        Popis
                        <input
                          type="text"
                          value={drink.description}
                          maxLength={180}
                          onChange={(event) => updateDrink(drink.id, "description", event.target.value)}
                          placeholder="Citron nebo bezinka podle dne"
                        />
                      </label>
                      <label>
                        Cena
                        <div className="menu-line-price-field">
                          <input
                            type="text"
                            value={drink.price}
                            inputMode="numeric"
                            maxLength={50}
                            onChange={(event) => updateDrink(drink.id, "price", normalizePrice(event.target.value))}
                            placeholder="65"
                          />
                          <span className="menu-line-suffix">Kč</span>
                        </div>
                      </label>
                    </div>

                    <button type="button" className="button ghost danger small" onClick={() => removeDrink(drink.id)}>
                      Smazat
                    </button>
                  </article>
                ))
              ) : (
                <div className="menu-category-empty">Zatím tu není žádný nápoj.</div>
              )}

              <button type="button" className="button ghost menu-category-add" onClick={addDrink}>
                Přidat nápoj
              </button>
            </div>
          </section>
      </section>

      {previewOpen ? (
        <div className="public-modal" role="dialog" aria-modal="true" aria-labelledby="menu-preview-title">
          <button type="button" className="public-modal-backdrop" aria-label="Zavřít náhled" onClick={() => setPreviewOpen(false)} />
          <div className="panel stack public-modal-panel menu-preview-modal-panel">
            <div className="row between wrap gap-sm">
              <div className="stack">
                <p className="eyebrow">Tiskový náhled</p>
                <h2 id="menu-preview-title">{title || "Denní menu"} / A4 booklet</h2>
                <p className="subtle">{formatLongDate(date)}</p>
              </div>
              <div className="row gap-sm wrap">
                <button type="button" className="button ghost" onClick={printMenu}>
                  Export do PDF
                </button>
                <button type="button" className="button ghost" onClick={() => setPreviewOpen(false)}>
                  Zavřít
                </button>
              </div>
            </div>

            {renderPreviewSheet({ title, date, note, groupedPreview, drinksPreview })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
