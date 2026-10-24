import type { Catalog, Dataset, DroneMission } from ".";
import { distanceKm } from "./format";

const PAIR_RADIUS_KM = 0.2;
const PAIR_MAX_DAYS = 1;

const day = (iso: string) => Date.parse(iso) / 864e5;

/**
 * Many locations are flown twice: a high straight-down flight and a low angled one.
 * Two missions count as one site when their centres are within 200 m, they were flown
 * within a day of each other, and exactly one is oblique.
 */
export function companionFlights(d: Dataset, catalog: Catalog): DroneMission[] {
  if (d.kind !== "drone" || d.lat === null || d.lng === null) return [];
  const here = { lat: d.lat, lng: d.lng };
  return catalog.missions.filter(
    (m) =>
      m.id !== d.id &&
      m.oblique !== d.oblique &&
      m.lat !== null &&
      m.lng !== null &&
      Math.abs(day(m.date) - day(d.date)) <= PAIR_MAX_DAYS &&
      distanceKm(here, { lat: m.lat, lng: m.lng }) <= PAIR_RADIUS_KM,
  );
}
