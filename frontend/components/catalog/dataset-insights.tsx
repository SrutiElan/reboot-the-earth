"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangleIcon, CheckIcon, CircleHelpIcon, MinusIcon } from "lucide-react";
import type { Dataset, DroneMission, GroundPlot } from "@/lib/catalog";
import { areaLabel, distanceKm, formatDate, plural, protocolLabel } from "@/lib/catalog/format";
import { companionFlights } from "@/lib/catalog/site";
import { trustFor, type TrustLevel } from "@/lib/catalog/trust";
import { cn } from "@/lib/utils";
import { useCatalog } from "./catalog-provider";
import { Panel } from "./panel";

const LEVEL: Record<TrustLevel, { label: string; badge: string }> = {
  high: { label: "High trust", badge: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200" },
  medium: { label: "Medium trust", badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  low: { label: "Low trust", badge: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
};

export function TrustBadge({ d, onOpen }: { d: Dataset; onOpen: () => void }) {
  const { catalog } = useCatalog();
  const t = trustFor(d, catalog);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${t.passed} of ${t.total} checks pass. Open the checklist.`}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", LEVEL[t.level].badge)}
    >
      {LEVEL[t.level].label}
      <span className="tabular-nums opacity-80">{t.passed}/{t.total}</span>
    </button>
  );
}

/** The checks behind the trust badge; it sits collapsed inside the data-use panel. */
export function TrustChecklist({ d }: { d: Dataset }) {
  const { catalog } = useCatalog();
  const t = trustFor(d, catalog);
  return (
    <div>
      <p className="px-5 py-3 text-[13px] leading-normal text-muted-foreground">
        {d.kind === "ground"
          ? "How safely can you treat this plot as ground truth for the drone imagery over it? Each line is one yes/no check."
          : "How safely can you check this flight against measured trees on the ground? Each line is one yes/no check."}
      </p>
      <ul className="border-t">
        {t.checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2.5 border-b border-border/60 px-5 py-2.5 text-sm last:border-0">
            {c.ok === true ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400" aria-label="Passes" />
              : c.ok === false ? <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-label="Does not pass" />
              : <CircleHelpIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Unknown" />}
            <span className="min-w-0">
              <span className="block font-medium">{c.label}</span>
              <span className="block text-xs text-muted-foreground">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">
        A checklist, not a quality score from the source: the badge shows how many checks pass.
      </p>
    </div>
  );
}

export const trustSummary = (d: Dataset, catalog: Parameters<typeof trustFor>[1]) => {
  const t = trustFor(d, catalog);
  return { ...t, label: LEVEL[t.level].label, badge: LEVEL[t.level].badge };
};

const dayMs = (iso: string) => Date.parse(iso.length === 4 ? `${iso}-07-01` : iso.length === 7 ? `${iso}-15` : iso);
const YEAR = 365.25 * 864e5;

function Row({ k, a, b, note }: { k: string; a: React.ReactNode; b: React.ReactNode; note?: React.ReactNode }) {
  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <th scope="row" className="w-[26%] py-2.5 pr-3 pl-5 text-left text-xs font-normal text-muted-foreground">{k}</th>
      <td className="px-3 py-2.5 text-[13px] tabular-nums">{a}</td>
      <td className="py-2.5 pr-5 pl-3 text-[13px] tabular-nums">{b}{note && <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>}</td>
    </tr>
  );
}

/** A ground plot next to one of the drone missions over it, with the differences that matter when using them together. */
export function ComparePanel({ d, bare }: { d: Dataset; bare?: boolean }) {
  const { catalog } = useCatalog();
  const others = useMemo(() => d.overlaps.map((id) => catalog.byId(id)).filter((x): x is Dataset => !!x && x.kind !== d.kind), [catalog, d]);
  const [chosen, setChosen] = useState<string | null>(null);
  if (!others.length) return null;

  const other = others.find((x) => x.id === chosen) ?? [...others].sort((x, y) => Math.abs(dayMs(x.date) - dayMs(d.date)) - Math.abs(dayMs(y.date) - dayMs(d.date)))[0];
  const plot = (d.kind === "ground" ? d : other) as GroundPlot;
  const mission = (d.kind === "drone" ? d : other) as DroneMission;

  const gapYears = (dayMs(mission.date) - dayMs(plot.date)) / YEAR;
  const offsetM = plot.lat !== null && plot.lng !== null && mission.lat !== null && mission.lng !== null
    ? distanceKm({ lat: plot.lat, lng: plot.lng }, { lat: mission.lat, lng: mission.lng }) * 1000 : null;
  const share = plot.plotHa && mission.areaHa ? (plot.plotHa / mission.areaHa) * 100 : null;
  const findings: { text: string; warn: boolean }[] = [
    Math.abs(gapYears) <= 1
      ? { text: `The flight is ${Math.abs(gapYears) < 0.1 ? "within weeks of" : `${Math.abs(gapYears).toFixed(1)} years ${gapYears > 0 ? "after" : "before"}`} the ground survey, close enough to compare.`, warn: false }
      : { text: `The flight is ${Math.abs(gapYears).toFixed(1)} years ${gapYears > 0 ? "after" : "before"} the ground survey. Trees may have grown, died or been cut in between.`, warn: true },
    plot.license && mission.license && plot.license !== mission.license
      ? { text: `Different licenses (${plot.license} and ${mission.license}). Check both before combining them.`, warn: true }
      : { text: "Same license on both.", warn: false },
    plot.withheld !== mission.withheld
      ? { text: "One is withheld from training and the other is not, so don't mix them in a training set.", warn: true }
      : { text: plot.withheld ? "Both are reserved for testing." : "Neither is withheld.", warn: false },
    plot.minDbh !== null && plot.minDbh > 10
      ? { text: `The plot only measured trees of ${plot.minDbh} cm DBH and up, so small trees visible in the imagery have no ground measurement.`, warn: true }
      : { text: "The plot measured small trees, so most trees in the imagery have a ground record.", warn: false },
  ];

  return (
    <Panel
      bare={bare}
      title="Plot and mission side by side"
      action={others.length > 1 ? (
        <select aria-label={`Compare with ${d.kind === "ground" ? "mission" : "plot"}`} value={other.id} onChange={(e) => setChosen(e.target.value)} className="h-8 max-w-[220px] rounded-md border bg-background px-1.5 text-xs">
          {others.map((x) => <option key={x.id} value={x.id}>{x.kind === "drone" ? `${formatDate(x.date)} · ${x.oblique ? "oblique" : "nadir"}` : x.name}</option> )}
        </select>
      ) : undefined}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left text-xs">
            <th className="py-2 pl-5"><span className="sr-only">Attribute</span></th>
            <th className="px-3 py-2 font-medium"><Link href={`/data/datasets/${plot.id}`} className="hover:underline">Ground plot {plot.sourceId}</Link></th>
            <th className="py-2 pr-5 pl-3 font-medium"><Link href={`/data/datasets/${mission.id}`} className="hover:underline">Drone {mission.sourceId}</Link></th>
          </tr>
        </thead>
        <tbody>
          <Row k="Date" a={formatDate(plot.date) + (plot.dateApproximate ? " (approx.)" : "")} b={formatDate(mission.date)} note={`${Math.abs(gapYears) < 0.1 ? "Same period" : `${Math.abs(gapYears).toFixed(1)} yr ${gapYears > 0 ? "later" : "earlier"}`}`} />
          <Row k="Area" a={areaLabel(plot)} b={areaLabel(mission)} note={share !== null ? `Plot is ${share < 1 ? "<1" : Math.round(share)}% of the flight` : undefined} />
          <Row k="Records" a={`${plural(plot.trees, "tree")}, ${protocolLabel(plot)}`} b={`${mission.imageCount?.toLocaleString() ?? "?"} images, ${mission.oblique ? "oblique" : "nadir"}${mission.altitudeM ? `, ${mission.altitudeM} m` : ""}`} />
          <Row k="Centre offset" a={offsetM !== null ? `${Math.round(offsetM)} m` : "—"} b="" note={offsetM !== null && offsetM > 10 ? "Centres differ by more than the usual 10 m GPS error, though the footprints still overlap." : undefined} />
          <Row k="License" a={plot.license ?? "—"} b={mission.license ?? "—"} />
          <Row k="Training split" a={plot.withheld ? "Withheld" : "Available"} b={mission.withheld ? "Withheld" : "Available"} />
        </tbody>
      </table>
      <ul className="border-t">
        {findings.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5 border-b border-border/60 px-5 py-2.5 text-[13px] last:border-0">
            {f.warn ? <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-label="Warning" /> : <MinusIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The high-altitude straight-down flight and the low-altitude angled flight over the same site, shown as one site. */
export function SitePanel({ d, bare }: { d: Dataset; bare?: boolean }) {
  const { catalog } = useCatalog();
  const pair = useMemo(() => companionFlights(d, catalog), [catalog, d]);
  if (d.kind !== "drone" || !pair.length) return null;
  const flights = [d, ...pair].sort((a, b) => (b.altitudeM ?? 0) - (a.altitudeM ?? 0));

  return (
    <Panel bare={bare} title="Paired flights at this site" action={<span className="text-xs text-muted-foreground">{plural(flights.length, "flight")}, same day</span>}>
      <div className="grid gap-px bg-border sm:grid-cols-2">
        {flights.map((f) => (
          <div key={f.id} className={cn("flex flex-col gap-2 bg-card px-5 py-4", f.id === d.id && "bg-selected")}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{f.oblique ? "Low, angled (oblique)" : "High, straight down (nadir)"}</span>
              {f.id === d.id && <span className="rounded bg-background px-1.5 text-[11px] font-medium">This page</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] tabular-nums">
              <div><dt className="text-xs text-muted-foreground">Altitude</dt><dd>{f.altitudeM ? `${f.altitudeM} m` : "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Camera pitch</dt><dd>{f.cameraPitch === null ? "—" : `${f.cameraPitch}°`}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Images</dt><dd>{f.imageCount?.toLocaleString() ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Area</dt><dd>{areaLabel(f)}</dd></div>
            </dl>
            {f.id !== d.id && <Link href={`/data/datasets/${f.id}`} className="text-[13px] font-medium text-primary hover:underline dark:text-drone-ink">Open this flight</Link>}
          </div>
        ))}
      </div>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">
        The straight-down flight maps the whole site; the angled flight sees the sides of trees. Use them together for tree detection and height checks.
      </p>
    </Panel>
  );
}
