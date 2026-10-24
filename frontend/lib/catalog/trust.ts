import type { Catalog, Dataset } from ".";
import { distanceKm, formatDate } from "./format";

export type TrustLevel = "high" | "medium" | "low";

export interface TrustCheck {
  label: string;
  /** true passes, false fails, null means the source data doesn't say */
  ok: boolean | null;
  detail: string;
}

export interface Trust {
  level: TrustLevel;
  passed: number;
  total: number;
  checks: TrustCheck[];
}

const YEAR_MS = 365.25 * 864e5;
const dateMs = (iso: string) => Date.parse(iso.length === 4 ? `${iso}-07-01` : iso.length === 7 ? `${iso}-15` : iso);

/** Years between a plot's survey and the closest flight over it (null when there is no flight). */
export function closestGapYears(d: Dataset, catalog: Catalog): number | null {
  const own = dateMs(d.date);
  const others = d.overlaps.map((id) => catalog.byId(id)).filter((x): x is Dataset => !!x && x.kind !== d.kind && !!x.date);
  const gaps = others.map((x) => Math.abs(dateMs(x.date) - own) / YEAR_MS).filter((g) => !Number.isNaN(g));
  return gaps.length && !Number.isNaN(own) ? Math.min(...gaps) : null;
}

/**
 * A plain checklist, not a model: how well can this record be used as ground truth or
 * matched against the other kind. The level is the share of checks passed.
 */
export function trustFor(d: Dataset, catalog: Catalog): Trust {
  const gap = closestGapYears(d, catalog);
  const covered = d.overlaps.length;
  const checks: TrustCheck[] = [
    { label: "License stated", ok: !!d.license, detail: d.license ?? "No license in the source data" },
    {
      label: d.kind === "ground" ? "Covered by a drone mission" : "Has ground plots inside it",
      ok: covered > 0,
      detail: covered ? `${covered} overlapping within 10 m` : "Nothing overlaps it, so there is no counterpart to compare",
    },
    {
      label: "Survey and flight dates close",
      ok: gap === null ? null : gap <= 1,
      detail: gap === null ? "No counterpart to compare dates with" : `Closest counterpart is ${gap < 1 ? `${Math.round(gap * 12)} months` : `${gap.toFixed(1)} years`} away`,
    },
  ];
  if (d.kind === "ground") {
    const small = d.minDbh !== null ? d.minDbh <= 10 : d.minHt !== null ? d.minHt <= 3 : null;
    checks.push(
      { label: "Exact survey date", ok: !d.dateApproximate, detail: d.dateApproximate ? `Approximate (${formatDate(d.date)})` : formatDate(d.date) },
      {
        label: "Small trees measured",
        ok: small,
        detail: small === null ? "Tally thresholds not stated" : `Complete above ${d.minDbh !== null ? `${d.minDbh} cm DBH` : `${d.minHt} m tall`}`,
      },
      { label: "Trees mapped", ok: d.trees > 0, detail: `${d.trees.toLocaleString()} stems` },
    );
  } else {
    checks.push(
      { label: "Altitude and camera known", ok: d.altitudeM !== null && d.cameraPitch !== null, detail: d.altitudeM !== null ? `${d.altitudeM} m, ${d.oblique ? "oblique" : "nadir"}` : "Flight settings missing" },
      { label: "Image count known", ok: d.imageCount !== null && d.imageCount > 0, detail: d.imageCount ? `${d.imageCount.toLocaleString()} images` : "Not stated" },
    );
  }
  const passed = checks.filter((c) => c.ok === true).length;
  const share = passed / checks.length;
  return { level: share >= 0.8 ? "high" : share >= 0.5 ? "medium" : "low", passed, total: checks.length, checks };
}

/** One paragraph for the assistant, so its answers use the same checks the page shows. */
export function focusSummary(d: Dataset, catalog: Catalog): string {
  const t = trustFor(d, catalog);
  const here = d.lat !== null && d.lng !== null ? { lat: d.lat, lng: d.lng } : null;
  const near = here
    ? catalog.all.filter((x) => x.id !== d.id && x.lat !== null && x.lng !== null && distanceKm(here, { lat: x.lat, lng: x.lng }) <= 5).length
    : 0;
  const facts = d.kind === "ground"
    ? `ground plot ${d.sourceId} (${d.id}), ${d.trees} trees, ${d.plotHa ?? "?"} ha, tally min DBH ${d.minDbh ?? "?"} cm / min height ${d.minHt ?? "?"} m, snags ${d.includesSnags ?? "?"}, top species ${d.species ?? "?"}`
    : `drone mission ${d.sourceId} (${d.id}), ${d.altitudeM ?? "?"} m, ${d.oblique ? "oblique" : "nadir"}, ${d.areaHa ?? "?"} ha, ${d.imageCount ?? "?"} images, aircraft ${d.aircraft ?? "?"}`;
  return [
    `${facts}; project ${d.site}; date ${d.date}${d.dateApproximate ? " (approximate)" : ""}; license ${d.license ?? "none"}; withheld from training: ${d.withheld}.`,
    `Overlapping records (within 10 m): ${d.overlaps.join(", ") || "none"}. Other datasets within 5 km: ${near}.`,
    `Trust checklist ${t.passed}/${t.total} (${t.level}): ${t.checks.map((c) => `${c.label}: ${c.ok === null ? "unknown" : c.ok ? "yes" : "no"} (${c.detail})`).join("; ")}.`,
  ].join(" ");
}
