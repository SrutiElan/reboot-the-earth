import type { Catalog, Bounds, Dataset, DatasetKind } from ".";

export interface Filters {
  yFrom: string;
  yTo: string;
  camera: string;
  alt: string;
  area: string;
  aircraft: string;
  overlap: boolean;
  noWithheld: boolean;
  license: string;
  minDbh: string;
  snags: boolean;
  repeat: boolean;
}

export const EMPTY_FILTERS: Filters = {
  yFrom: "",
  yTo: "",
  camera: "",
  alt: "",
  area: "",
  aircraft: "",
  overlap: false,
  noWithheld: false,
  license: "",
  minDbh: "",
  snags: false,
  repeat: false,
};

export const ALL_KINDS: DatasetKind[] = ["drone", "ground"];

interface Option {
  value: string;
  label: string;
}

// The sidebar and the mobile filter sheet both render from this list: add, remove or reorder sections here.
export type FilterSection =
  | { type: "year-range"; label: string }
  | { type: "segmented"; key: "camera" | "alt" | "area" | "minDbh"; label: string; options: Option[]; chip: string }
  | { type: "select"; key: "aircraft" | "license"; label: string; anyLabel: string; options: Option[] }
  | { type: "divider" }
  | { type: "switch"; key: "overlap" | "noWithheld" | "snags" | "repeat"; label: string; description: string; chip: string };

export const FILTER_SECTIONS: FilterSection[] = [
  { type: "year-range", label: "Year collected" },
  {
    type: "segmented",
    key: "camera",
    label: "Camera angle",
    chip: "",
    options: [
      { value: "", label: "Any" },
      { value: "nadir", label: "Nadir" },
      { value: "oblique", label: "Oblique" },
    ],
  },
  {
    type: "segmented",
    key: "alt",
    label: "Flight altitude",
    chip: "Altitude",
    options: [
      { value: "", label: "Any" },
      { value: "low", label: "≤ 80 m" },
      { value: "mid", label: "81–110 m" },
      { value: "high", label: "> 110 m" },
    ],
  },
  {
    type: "segmented",
    key: "area",
    label: "Mission area",
    chip: "Area",
    options: [
      { value: "", label: "Any" },
      { value: "s", label: "< 10 ha" },
      { value: "m", label: "10–50 ha" },
      { value: "l", label: "> 50 ha" },
    ],
  },
  {
    type: "select",
    key: "aircraft",
    label: "Aircraft",
    anyLabel: "Any aircraft",
    options: [],
  },
  {
    type: "select",
    key: "license",
    label: "License",
    anyLabel: "Any license",
    options: [],
  },
  { type: "divider" },
  {
    type: "segmented",
    key: "minDbh",
    label: "Smallest tree measured (plots)",
    chip: "Min DBH",
    options: [
      { value: "", label: "Any" },
      { value: "5", label: "≤ 5 cm" },
      { value: "10", label: "≤ 10 cm" },
      { value: "20", label: "≤ 20 cm" },
    ],
  },
  {
    type: "switch",
    key: "snags",
    label: "Includes dead trees (snags)",
    description: "Ground plots whose tally rules count standing dead trees.",
    chip: "Includes snags",
  },
  { type: "divider" },
  {
    type: "switch",
    key: "repeat",
    label: "Repeat drone coverage",
    description: "Locations flown on two or more different dates, so you can compare change over time.",
    chip: "Repeat coverage",
  },
  {
    type: "switch",
    key: "overlap",
    label: "Drone and ground overlap",
    description: "Missions with ground plots inside their footprint, and plots covered by a mission.",
    chip: "Drone and ground overlap",
  },
  {
    type: "switch",
    key: "noWithheld",
    label: "Exclude withheld records",
    description: "Hide missions and plots reserved for testing machine-learning models.",
    chip: "Excluding withheld",
  },
];

export interface Chip {
  id: string;
  label: string;
  clear: Partial<Filters>;
}

export function filterChips(f: Filters): Chip[] {
  const chips: Chip[] = [];
  if (f.yFrom || f.yTo) {
    const label =
      f.yFrom && f.yTo
        ? f.yFrom === f.yTo
          ? f.yFrom
          : `${f.yFrom}–${f.yTo}`
        : f.yFrom
          ? `${f.yFrom} or later`
          : `${f.yTo} or earlier`;
    chips.push({ id: "year", label, clear: { yFrom: "", yTo: "" } });
  }
  for (const s of FILTER_SECTIONS) {
    if (s.type === "segmented" && f[s.key]) {
      const opt = s.options.find((o) => o.value === f[s.key]);
      chips.push({ id: s.key, label: [s.chip, opt?.label].filter(Boolean).join(" "), clear: { [s.key]: "" } });
    } else if (s.type === "select" && f[s.key]) {
      chips.push({ id: s.key, label: f[s.key], clear: { [s.key]: "" } });
    } else if (s.type === "switch" && f[s.key]) {
      chips.push({ id: s.key, label: s.chip, clear: { [s.key]: false } });
    }
  }
  return chips;
}

/** Distinct drone flight dates covering a plot (or a mission's plots). */
export function flightDates(d: Dataset, catalog: Catalog): string[] {
  const missions = d.kind === "drone" ? [d] : d.overlaps.map((id) => catalog.byId(id)).filter((m): m is Dataset => !!m);
  return [...new Set(missions.filter((m) => m.kind === "drone" && m.date).map((m) => m.date))].sort();
}

function hasRepeatCoverage(d: Dataset, catalog: Catalog): boolean {
  if (d.kind === "ground") return flightDates(d, catalog).length >= 2;
  return d.overlaps.some((id) => { const plot = catalog.byId(id); return !!plot && flightDates(plot, catalog).length >= 2; });
}

function passes(d: Dataset, f: Filters, q: string, catalog: Catalog): boolean {
  if (f.yFrom && (d.year === null || d.year < +f.yFrom)) return false;
  if (f.yTo && (d.year === null || d.year > +f.yTo)) return false;
  if (f.overlap && !d.overlaps.length) return false;
  if (f.license && d.license !== f.license) return false;
  if (f.noWithheld && d.withheld) return false;
  if (f.repeat && !hasRepeatCoverage(d, catalog)) return false;
  if (q && !(d.name.toLowerCase().includes(q) || d.site.toLowerCase().includes(q) || d.id.includes(q))) {
    return false;
  }
  if (d.kind === "drone") {
    if (f.camera === "nadir" && d.oblique) return false;
    if (f.camera === "oblique" && !d.oblique) return false;
    if (f.aircraft && d.aircraft !== f.aircraft) return false;
    if (f.alt) {
      if (d.altitudeM == null) return false;
      if (f.alt === "low" && d.altitudeM > 80) return false;
      if (f.alt === "mid" && (d.altitudeM <= 80 || d.altitudeM > 110)) return false;
      if (f.alt === "high" && d.altitudeM <= 110) return false;
    }
    if (f.area && d.areaHa === null) return false;
    if (f.area === "s" && d.areaHa !== null && d.areaHa >= 10) return false;
    if (f.area === "m" && d.areaHa !== null && (d.areaHa < 10 || d.areaHa > 50)) return false;
    if (f.area === "l" && d.areaHa !== null && d.areaHa <= 50) return false;
    // Plot-only filters keep the missions that cover a matching plot.
    if (f.minDbh || f.snags) {
      const plotOnly = { ...EMPTY_FILTERS, minDbh: f.minDbh, snags: f.snags, noWithheld: f.noWithheld };
      return d.overlaps.some((id) => { const plot = catalog.byId(id); return !!plot && passes(plot, plotOnly, "", catalog); });
    }
    return true;
  }
  if (f.minDbh && !(d.minDbh !== null && d.minDbh <= +f.minDbh)) return false;
  if (f.snags && !d.includesSnags) return false;
  // Drone-only filters keep the ground plots covered by a matching mission.
  if (f.camera || f.aircraft || f.alt || f.area) {
    const droneOnly = { ...f, overlap: false, yFrom: "", yTo: "", license: "", minDbh: "", snags: false, repeat: false };
    return d.overlaps.some((id) => { const mission = catalog.byId(id); return !!mission && passes(mission, droneOnly, "", catalog); });
  }
  return true;
}

export interface Query {
  filters: Filters;
  query?: string;
  kinds?: DatasetKind[];
  ids?: Set<string> | null;
}

export function filterDatasets(catalog: Catalog, { filters, query = "", kinds = ALL_KINDS, ids = null }: Query): Dataset[] {
  const q = query.trim().toLowerCase();
  return catalog.all.filter(
    (d) => kinds.includes(d.kind) && (!ids || ids.has(d.id)) && passes(d, filters, q, catalog),
  );
}

export function inBounds(d: Dataset, b: Bounds | null) {
  if (!b) return true;
  return d.lat !== null && d.lng !== null && d.lat >= b.south && d.lat <= b.north && d.lng >= b.west && d.lng <= b.east;
}
