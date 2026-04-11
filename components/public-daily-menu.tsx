"use client";

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

function formatPrice(value: string) {
  if (!value) return "-";
  return /\b(kč|kc)\b/i.test(value) ? value : `${value} Kč`;
}

export function PublicDailyMenu({ initialDate, initialMenu }: Props) {
  const menu = initialMenu;

  return (
    <article className="public-card daily-menu-card">
      <div className="daily-menu-head">
        <div>
          <p className="eyebrow">Denní menu</p>
          <h3>{menu?.title ?? "Denní menu"}</h3>
          <p className="public-muted">{formatLongDate(initialDate)}</p>
        </div>
        <span className="daily-menu-date-badge">{formatLongDate(initialDate)}</span>
      </div>

      <p className="daily-menu-note">
        {menu?.note || "Na hlavní stránce zatím není zveřejněné žádné denní menu."}
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
              <span>{formatPrice(item.price)}</span>
            </li>
          ))
        ) : (
          <li className="daily-menu-row empty">
            <span>Denní menu ještě není zveřejněné v adminu.</span>
          </li>
        )}
      </ul>
    </article>
  );
}
