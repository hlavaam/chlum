import type { LocationRecord } from "@/types/models";

function normalizeLocationText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isBaseLocation(location: Pick<LocationRecord, "code" | "name">) {
  const normalized = normalizeLocationText(`${location.code} ${location.name}`);
  return normalized.includes("chlum") || normalized.includes("vysker");
}

export function filterBaseLocations<T extends Pick<LocationRecord, "code" | "name">>(locations: T[]) {
  return locations.filter(isBaseLocation);
}
