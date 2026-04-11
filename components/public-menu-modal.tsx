"use client";

import { useState } from "react";

type MenuItem = {
  name: string;
  description: string;
  price: string;
};

type MenuCategory = {
  title: string;
  items: MenuItem[];
};

type Props = {
  categories: MenuCategory[];
};

export function PublicMenuModal({ categories }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="button public-menu-modal-trigger" onClick={() => setOpen(true)}>
        Zobrazit celé menu
      </button>

      {open ? (
        <div className="public-modal">
          <button type="button" className="public-modal-backdrop" aria-label="Zavřít menu" onClick={() => setOpen(false)} />
          <div className="panel public-modal-panel stack">
            <div className="row between wrap gap-sm">
              <div className="stack">
                <p className="eyebrow">Celé menu</p>
                <h2>Restaurace Vyskeř</h2>
              </div>
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>
                Zavřít
              </button>
            </div>

            <div className="public-modal-menu-grid">
              {categories.map((category) => (
                <section key={category.title} className="public-modal-menu-group stack">
                  <h3>{category.title}</h3>
                  {category.items.map((item) => (
                    <div key={`${category.title}-${item.name}`} className="public-modal-menu-row">
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.description}</p>
                      </div>
                      <span>{item.price}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
