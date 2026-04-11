"use client";

import { useEffect, useMemo, useState } from "react";

import type { OpeningHoursDay } from "@/types/models";

type Props = {
  openingHours: OpeningHoursDay[];
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function getPragueWeekdayIndex() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Europe/Prague",
  }).format(new Date());
  return WEEKDAY_TO_INDEX[weekday] ?? 0;
}

export function PublicOpeningHoursBubble({ openingHours }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 120);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const todayHours = useMemo(() => openingHours[getPragueWeekdayIndex()] ?? openingHours[0], [openingHours]);
  const text = todayHours.closed ? "Dnes zavřeno" : `Dnes otevřeno ${todayHours.open} - ${todayHours.close}`;

  return (
    <a href="#kontakt" className={`public-hours-bubble ${visible ? "visible" : ""}`.trim()} aria-label={text}>
      <span className="public-hours-bubble-kicker">Dnešek</span>
      <strong>{text}</strong>
    </a>
  );
}
