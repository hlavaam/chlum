"use client";

import { useState } from "react";

import type { DailyDrinkItem, DailyMenuDayRecord } from "@/types/models";

type Props = {
  publishedDate: string;
  publishedMenu: DailyMenuDayRecord | null;
};

type ActiveTab = "daily" | "drinks";

const DAILY_MENU_LABELS: Record<string, string> = {
  Polevka: "Polévka",
  Predkrm: "Předkrm",
  "Hlavni chod": "Hlavní chod",
  Dezert: "Dezert",
};

const TAB_COPY: Record<ActiveTab, { eyebrow: string; title: string; text: string }> = {
  daily: {
    eyebrow: "Denní menu",
    title: "Denní menu",
    text: "",
  },
  drinks: {
    eyebrow: "Nápoje",
    title: "Pití k obědu, večeru i delšímu posezení.",
    text: "Domácí limonády, víno i další pití, které funguje samostatně i jako doprovod k jídlu.",
  },
};

function formatLongDate(date: string) {
  try {
    return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "full" }).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}

function formatPrice(value: string) {
  if (!value) return "-";
  return /\b(kč|kc)\b/i.test(value) ? value : `${value} Kč`;
}

function getGroupedMenu(menu: DailyMenuDayRecord | null) {
  if (!menu?.items?.length) {
    return [];
  }

  const baseGroups = Object.entries(DAILY_MENU_LABELS).map(([value, label]) => ({
    value,
    label,
    items: menu.items.filter((item) => item.category === value),
  }));

  const customCategories = Array.from(
    new Set(menu.items.map((item) => item.category).filter((category) => category && !DAILY_MENU_LABELS[category])),
  ).map((category) => ({
    value: category,
    label: category,
    items: menu.items.filter((item) => item.category === category),
  }));

  return [...baseGroups, ...customCategories].filter((group) => group.items.length > 0);
}

export function PublicMenuSwitcher({ publishedDate, publishedMenu }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("daily");
  const copy = TAB_COPY[activeTab];
  const groupedMenu = getGroupedMenu(publishedMenu);
  const drinks = (publishedMenu?.drinks ?? []).filter((item): item is DailyDrinkItem => Boolean(item?.name));

  return (
    <div className={`public-menu-switcher ${activeTab === "drinks" ? "is-drinks" : "is-daily"}`.trim()}>
      <div className="public-menu-switch" role="tablist" aria-label="Přepínač menu">
        <span className="public-menu-switch-indicator" aria-hidden="true" />
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "daily"}
          className={`public-menu-switch-button ${activeTab === "daily" ? "active" : ""}`.trim()}
          onClick={() => setActiveTab("daily")}
        >
          Denní menu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "drinks"}
          className={`public-menu-switch-button ${activeTab === "drinks" ? "active" : ""}`.trim()}
          onClick={() => setActiveTab("drinks")}
        >
          Nápoje
        </button>
      </div>

      <div key={activeTab} className="public-menu-stage">
        <div className="public-menu-stage-copy">
          {activeTab === "daily" ? null : <p className="eyebrow">{copy.eyebrow}</p>}
          <h3>{activeTab === "daily" ? "Denní menu" : copy.title}</h3>
          {activeTab === "daily" ? (
            <p className="public-menu-stage-date">
              {publishedMenu ? formatLongDate(publishedDate) : "Denní menu zatím není zveřejněné."}
            </p>
          ) : (
            <p>{copy.text}</p>
          )}
        </div>

        {activeTab === "daily" ? (
          groupedMenu.length ? (
            <div className="public-menu-stage-groups daily">
              {groupedMenu.map((group) => (
                <section key={group.value} className="public-menu-stage-group">
                  <div className="public-menu-stage-group-head">
                    <h4>{group.label}</h4>
                  </div>

                  <div className="public-menu-stage-list">
                    {group.items.map((item, index) => (
                      <article key={`${group.value}-${item.name}-${index}`} className="public-menu-stage-row">
                        <div>
                          <strong>{item.name}</strong>
                          {item.allergens ? <p>Alergeny: {item.allergens}</p> : null}
                        </div>
                        <span>{formatPrice(item.price)}</span>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="public-menu-stage-empty">Denní menu ještě není zveřejněné v adminu.</div>
          )
        ) : (
          drinks.length ? (
            <div className="public-menu-stage-groups drinks">
              <section className="public-menu-stage-group">
                <div className="public-menu-stage-group-head">
                  <h4>Nápoje</h4>
                </div>

                <div className="public-menu-stage-list">
                  {drinks.map((item, index) => (
                    <article key={`${item.name}-${index}`} className="public-menu-stage-row">
                      <div>
                        <strong>{item.name}</strong>
                        {item.description ? <p>{item.description}</p> : null}
                      </div>
                      <span>{formatPrice(item.price)}</span>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="public-menu-stage-empty">Nápoje ještě nejsou vyplněné v adminu.</div>
          )
        )}
      </div>
    </div>
  );
}
