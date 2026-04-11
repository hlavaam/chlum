import type { HomepageSectionRecord } from "@/types/models";

export const HOMEPAGE_ABOUT_SECTION_ID = "homepage-about";

export const DEFAULT_HOMEPAGE_ABOUT = {
  sectionKey: "about" as const,
  eyebrow: "O nás",
  title: "Poctivá kuchyně, lokální suroviny a atmosféra, která se nesnaží být hlučná.",
  points: [
    "Vaříme z lokálních surovin a stavíme na jednoduchosti, která chutná.",
    "Menu držíme čisté, sezónní a bez zbytečné přehlídky efektů.",
    "Vyskeř je o atmosféře, kde si host sedne, vydechne a nikam nespěchá.",
  ],
  primaryImage: "/hero/kaplicka.jpg",
  secondaryImage: "/hero/kaplicka.jpg",
};

function normalizePoints(points: string[] | undefined) {
  const fallback = DEFAULT_HOMEPAGE_ABOUT.points;
  const next = Array.from({ length: 3 }, (_, index) => points?.[index]?.trim() || fallback[index]);
  return next;
}

export function normalizeHomepageAboutSection(
  section: Partial<HomepageSectionRecord> | null | undefined,
): HomepageSectionRecord {
  return {
    id: section?.id ?? HOMEPAGE_ABOUT_SECTION_ID,
    createdAt: section?.createdAt ?? "2026-04-07T00:00:00.000Z",
    updatedAt: section?.updatedAt ?? "2026-04-07T00:00:00.000Z",
    sectionKey: "about",
    eyebrow: section?.eyebrow?.trim() || DEFAULT_HOMEPAGE_ABOUT.eyebrow,
    title: section?.title?.trim() || DEFAULT_HOMEPAGE_ABOUT.title,
    points: normalizePoints(section?.points),
    primaryImage: section?.primaryImage?.trim() || DEFAULT_HOMEPAGE_ABOUT.primaryImage,
    secondaryImage: section?.secondaryImage?.trim() || DEFAULT_HOMEPAGE_ABOUT.secondaryImage,
  };
}
