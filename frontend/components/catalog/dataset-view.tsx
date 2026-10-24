"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, DownloadIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";
import type { Dataset, DroneMission, GroundPlot } from "@/lib/catalog";
import { API_BASE, apiJson, datasetFileUrl } from "@/lib/api";
import { focusSummary } from "@/lib/catalog/trust";
import { companionFlights } from "@/lib/catalog/site";
import { areaLabel, datasetFiles, distanceKm, formatDate, licenseTerms, licenseUrl, plural, protocolLabel } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";
import { AssistantDock } from "./assistant-dock";
import { DatasetMapPanel } from "./dataset-map-panel";
import { ComparePanel, SitePanel, TrustBadge, TrustChecklist, trustSummary } from "./dataset-insights";
import { Panel } from "./panel";
import { KindBadge, KindMark } from "./kind-mark";
import { CatalogSwitcher } from "./catalog-switcher";
import { useCopy } from "./use-copy";

function pythonFor(d: Dataset) {
  return d.kind === "drone"
    ? `import requests\n\nmetadata = requests.get(\n    "${datasetFileUrl(d.id, "metadata.json")}", timeout=30\n).json()\nprint(metadata)`
    : `import pandas as pd\nimport geopandas as gpd\n\ntrees = pd.read_csv(\n    "${datasetFileUrl(d.id, "trees.csv")}"
)\nstems = gpd.read_file(\n    "${datasetFileUrl(d.id, "trees.geojson")}"
)`;
}

const NEARBY_KM = 5;

/** License, restrictions and credit, with the trust checklist folded away until asked for. */
function UsePanel({ d, trustOpen, setTrustOpen }: { d: Dataset; trustOpen: boolean; setTrustOpen: (open: boolean) => void }) {
  const { catalog } = useCatalog();
  const [copied, copy] = useCopy();
  const url = licenseUrl(d.license);
  const trust = trustSummary(d, catalog);
  const credit = `${d.contributors ?? "Unknown contributors"}. ${d.name} (${d.id}), Open Forest Observatory. License: ${d.license ?? "not stated"}.`;
  const notes = [licenseTerms(d.license), d.withheld ? "Reserved for testing machine-learning models; keep it out of training data." : null, d.kind === "ground" ? "Trees below the smallest measured size were not recorded, so counts are only complete above it." : null].filter(Boolean);
  return (
    <Panel title="Data use and trust">
      <dl className="grid gap-x-5 gap-y-3.5 p-5 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
        <div>
          <dt className="text-xs text-muted-foreground">License</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                {d.license}
                <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
            ) : (d.license ?? "Not stated")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Training split</dt>
          <dd className="mt-0.5 text-sm font-medium">{d.withheld ? "Withheld (test set)" : "Available"}</dd>
        </div>
        {d.kind === "ground" && (
          <div>
            <dt className="text-xs text-muted-foreground">Smallest tree measured</dt>
            <dd className="mt-0.5 text-sm font-medium">{protocolLabel(d)}</dd>
          </div>
        )}
      </dl>
      <ul className="flex flex-col gap-1 border-t px-5 py-3 text-[13px] leading-normal text-muted-foreground">
        {notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
      <div className="flex items-start gap-3 border-t px-5 py-3">
        <p className="min-w-0 flex-1 text-xs leading-normal text-muted-foreground">
          <span className="font-medium text-foreground">Credit: </span>
          {credit}
        </p>
        <Button variant="outline" size="sm" className="h-8 shrink-0 px-3" onClick={() => copy(credit, "credit")}>
          {copied === "credit" ? "Copied" : "Copy"}
        </Button>
      </div>
      <details id="trust" open={trustOpen} onToggle={(e) => setTrustOpen(e.currentTarget.open)} className="group scroll-mt-4 border-t">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
          <span className="flex-1">Trust checklist</span>
          <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", trust.badge)}>{trust.label} · {trust.passed}/{trust.total}</span>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t"><TrustChecklist d={d} /></div>
      </details>
    </Panel>
  );
}

interface Imagery {
  available: boolean | null;
  folder: string | null;
  products: { label: string; url: string; bytes: number }[];
}

const megabytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);


/** Links to a mission's large files in the public bucket. The map's layers panel draws the images themselves. */
function ImageryList({ id }: { id: string }) {
  const [state, setState] = useState<{ id: string; imagery: Imagery | null; failed: boolean }>({ id: "", imagery: null, failed: false });
  useEffect(() => {
    const abort = new AbortController();
    apiJson<Imagery>(`/api/catalog/datasets/${encodeURIComponent(id)}/imagery`, { signal: abort.signal })
      .then((imagery) => setState({ id, imagery, failed: false }))
      .catch(() => !abort.signal.aborted && setState({ id, imagery: null, failed: true }));
    return () => abort.abort();
  }, [id]);
  const current = state.id === id ? state : null;
  const imagery = current?.imagery;
  return (
    <div className="border-t">
      <h3 className="px-5 pt-3 pb-1 text-xs font-medium text-muted-foreground">Drone imagery (public bucket, large files)</h3>
      {!current ? (
        <p className="px-5 pb-3 text-sm text-muted-foreground">Looking up imagery…</p>
      ) : current.failed || imagery?.available === null ? (
        <p className="px-5 pb-3 text-sm text-muted-foreground">The imagery bucket could not be reached right now.</p>
      ) : !imagery?.available ? (
        <p className="px-5 pb-3 text-sm text-muted-foreground">No public imagery was found for this mission.</p>
      ) : (
        <>
          <ul>
            {imagery.products.map((p) => (
              <li key={p.url} className="flex items-center gap-3 border-b border-border/60 px-5 py-2 last:border-0">
                <span className="min-w-0 flex-1 text-sm">{p.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{megabytes(p.bytes)}</span>
                <Button asChild variant="outline" size="sm" className="h-7 px-2.5">
                  <a href={p.url} target="_blank" rel="noreferrer">Open</a>
                </Button>
              </li>
            ))}
          </ul>
          {imagery.folder && <p className="border-t px-5 py-2.5 text-xs"><a href={imagery.folder} target="_blank" rel="noreferrer" className="text-muted-foreground underline">Browse all mission files</a></p>}
        </>
      )}
    </div>
  );
}

const dayMs = (iso: string) => Date.parse(iso.length === 4 ? `${iso}-07-01` : iso.length === 7 ? `${iso}-15` : iso);

/** One plot's ground survey against every drone flight over it. Ground plots are surveyed once, so this is imagery change over time, not tree growth. */
function TimelineBody({ plot, flights }: { plot: GroundPlot; flights: DroneMission[] }) {
  const surveyed = dayMs(plot.date);
  const dated = flights.filter((f) => f.date && !Number.isNaN(dayMs(f.date))).sort((a, b) => dayMs(a.date) - dayMs(b.date));
  const times = [surveyed, ...dated.map((f) => dayMs(f.date))].filter((t) => !Number.isNaN(t));
  if (dated.length === 0 || times.length === 0) return null;
  const pad = 60 * 864e5;
  const lo = Math.min(...times) - pad;
  const span = Math.max(Math.max(...times) + pad - lo, 1);
  const at = (t: number) => `${((t - lo) / span) * 100}%`;
  const dates = new Set(dated.map((f) => f.date));
  const ticks: number[] = [];
  for (let y = new Date(lo).getUTCFullYear() + 1; Date.UTC(y, 0, 1) < lo + span; y++) ticks.push(Date.UTC(y, 0, 1));
  const gap = (f: DroneMission) => {
    const years = (dayMs(f.date) - surveyed) / (365.25 * 864e5);
    if (Math.abs(years) < 0.04) return "Same time as the ground survey";
    const amount = Math.abs(years) < 1 ? `${Math.round(Math.abs(years) * 12)} mo` : `${Math.abs(years).toFixed(1)} yr`;
    return `${amount} ${years > 0 ? "after" : "before"} the ground survey`;
  };

  return (
    <div>
      <div className="px-5 pt-6 pb-2">
        <div className="relative mx-3 h-12" role="img" aria-label={`Ground survey ${formatDate(plot.date)} and drone flights on ${[...dates].map(formatDate).join(", ")}`}>
          <div className="absolute inset-x-0 top-5 h-px bg-border" />
          {ticks.map((t) => (
            <span key={t} className="absolute top-7 -translate-x-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ left: at(t) }}>
              {new Date(t).getUTCFullYear()}
            </span>
          ))}
          {[...dates].map((date) => (
            <span key={date} className="absolute top-[14px] size-[13px] -translate-x-1/2 rounded-[3px] border-2 border-background bg-drone" style={{ left: at(dayMs(date)) }} title={`Drone flight ${formatDate(date)}`} />
          ))}
          <span className="absolute top-[11px] size-[19px] -translate-x-1/2 rounded-full border-[3px] border-background bg-ground ring-1 ring-ground-ink/40" style={{ left: at(surveyed) }} title={`Ground survey ${formatDate(plot.date)}`} />
        </div>
      </div>
      <ol className="border-t">
        <li className="flex items-center gap-2.5 border-b border-border/60 px-5 py-2.5 text-sm">
          <KindMark kind="ground" className="size-[9px]" />
          <span className="font-medium tabular-nums">{formatDate(plot.date)}</span>
          <span className="text-muted-foreground">Ground survey · {plural(plot.trees, "tree")} measured</span>
        </li>
        {dated.map((f) => (
          <li key={f.id} className="border-b border-border/60 last:border-0">
            <Link href={`/data/datasets/${f.id}`} className="flex items-center gap-2.5 px-5 py-2.5 text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted/60">
              <KindMark kind="drone" className="size-[9px]" />
              <span className="font-medium tabular-nums">{formatDate(f.date)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {f.oblique ? "Oblique" : "Nadir"}{f.altitudeM ? `, ${f.altitudeM} m` : ""} · {gap(f)}
              </span>
              <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">
        Each plot was measured on the ground once, so tree growth over time isn&apos;t in this data. Repeat flights let you compare canopy change in the imagery; flights far from the survey date may not match the measured trees.
      </p>
    </div>
  );
}

function RecordLink({ r, note }: { r: Dataset; note?: string }) {
  return (
    <li>
      <Link
        href={`/data/datasets/${r.id}`}
        className="flex items-center gap-2.5 border-b border-border/60 px-5 py-3 outline-none last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60"
      >
        <KindMark kind={r.kind} className="size-[9px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{r.name}</span>
          <span className="mt-px flex flex-wrap gap-x-2.5 text-xs text-muted-foreground tabular-nums">
            <span>{r.date}</span>
            {r.kind === "drone" ? <span>{r.oblique ? "Oblique" : "Nadir"}{r.altitudeM ? `, ${r.altitudeM} m` : ""}</span> : <span>{plural(r.trees, "tree")}</span>}
            {note && <span>{note}</span>}
          </span>
        </span>
        <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

type TabKey = "overlap" | "timeline" | "compare" | "pair" | "nearby";

export function DatasetView({ id }: { id: string }) {
  const { catalog, catalogLoading, catalogError, reloadCatalog, collection, toggleCollection, setFocus, dockOpen } = useCatalog();
  const d = catalog.byId(id);
  const [codeTab, setCodeTab] = useState<"python" | "json">("python");
  const [copied, copy] = useCopy();
  const [trustOpen, setTrustOpen] = useState(false);
  // #timeline (used by the assistant's "open" action) lands on the timeline tab.
  const [tab, setTab] = useState<TabKey>(() => (typeof window !== "undefined" && window.location.hash === "#timeline" ? "timeline" : "overlap"));

  const nearby = useMemo(() => {
    if (!d || d.lat === null || d.lng === null) return [];
    const here = { lat: d.lat, lng: d.lng };
    return catalog.all
      .filter((x) => x.id !== d.id && !d.overlaps.includes(x.id) && x.lat !== null && x.lng !== null)
      .map((x) => ({ x, km: distanceKm(here, { lat: x.lat!, lng: x.lng! }) }))
      .filter((n) => n.km <= NEARBY_KM)
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
  }, [catalog, d]);

  // Tell the assistant which record is open so "this plot" questions work.
  useEffect(() => {
    if (!d) return;
    setFocus({ id: d.id, text: focusSummary(d, catalog) });
    return () => setFocus(null);
  }, [d, catalog, setFocus]);

  if (catalogLoading) return <p className="p-8 text-muted-foreground">Loading dataset…</p>;
  if (catalogError) return <p role="alert" className="p-8">{catalogError} <button type="button" onClick={reloadCatalog} className="underline">Retry</button></p>;
  if (!d) return <p className="p-8">Dataset not found. <Link href="/data/catalog" className="underline">Return to catalog</Link></p>;
  const files = datasetFiles(d);
  const related = d.overlaps.map((x) => catalog.byId(x)).filter((r): r is Dataset => !!r);
  const flights = related.filter((r): r is DroneMission => r.kind === "drone");
  const inCol = collection.includes(d.id);
  const code = codeTab === "python" ? pythonFor(d) : datasetFileUrl(d.id, "metadata.json");
  const kmLabel = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`);
  // Many sites have a high straight-down flight and a low angled one a few metres apart.
  const companions = new Set(companionFlights(d, catalog).map((m) => m.id));
  const companion = (x: Dataset) => companions.has(x.id);
  const stats =
    d.kind === "drone"
      ? [
          { k: "Collected", v: formatDate(d.date) },
          { k: "Area", v: areaLabel(d) },
          { k: "Altitude", v: d.altitudeM ? `${d.altitudeM} m` : "—" },
          { k: "Images", v: d.imageCount?.toLocaleString() ?? "—" },
        ]
      : [
          { k: "Surveyed", v: formatDate(d.date) + (d.dateApproximate ? " (approx.)" : "") },
          { k: "Trees mapped", v: d.trees.toLocaleString() },
          { k: "Plot area", v: areaLabel(d) },
          { k: "Smallest tree", v: protocolLabel(d) },
        ];
  const subtitle = [d.site, d.kind === "drone" ? [d.aircraft, d.cameraPitch === null ? null : `${d.oblique ? "oblique" : "nadir"} ${d.cameraPitch}°`].filter(Boolean).join(", ") : d.species].filter(Boolean).join(" · ");

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overlap", label: d.kind === "drone" ? "Plots inside" : "Missions over it", count: related.length },
    ...(d.kind === "ground" && flights.length ? [{ key: "timeline" as const, label: "Timeline" }] : []),
    ...(related.some((r) => r.kind !== d.kind) ? [{ key: "compare" as const, label: "Compare" }] : []),
    ...(companions.size ? [{ key: "pair" as const, label: "Paired flights" }] : []),
    ...(nearby.length ? [{ key: "nearby" as const, label: "Nearby", count: nearby.length }] : []),
  ];
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;
  const openTrust = () => {
    setTrustOpen(true);
    requestAnimationFrame(() => document.getElementById("trust")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <div className="flex h-[calc(100dvh-var(--nav-h))] min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-5 pt-4">
          <nav aria-label="Breadcrumb" className="flex flex-1 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/data" className="text-foreground hover:underline">Data</Link>
            <ChevronRightIcon className="size-3.5" aria-hidden />
            <Link href="/data/catalog" className="text-foreground hover:underline">All datasets</Link>
            <ChevronRightIcon className="size-3.5" aria-hidden />
            <span aria-current="page" className="tabular-nums">{d.id}</span>
          </nav>
          <CatalogSwitcher />
        </div>

        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 pt-6 pb-20">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge kind={d.kind} long />
                <TrustBadge d={d} onOpen={openTrust} />
              </div>
              <h1 className="text-[clamp(22px,3vw,28px)] leading-tight font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">{d.name}</h1>
              {subtitle && <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={inCol ? "secondary" : "default"}
                className={cn("h-[38px] gap-2 px-3.5", !inCol && "hover:bg-primary-hover")}
                onClick={() => toggleCollection(d.id)}
                aria-pressed={inCol}
              >
                {inCol ? <CheckIcon className="size-[15px]" /> : <PlusIcon className="size-[15px]" />}
                {inCol ? "In collection" : "Add to collection"}
              </Button>
              <Button asChild variant="outline" className="h-[38px] gap-2 px-4">
                <a href={`${API_BASE}/api/catalog/datasets/${d.id}/download`}><DownloadIcon className="size-[15px]" />Download (ZIP)</a>
              </Button>
            </div>
          </header>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4">
            {stats.map((x) => (
              <div key={x.k} className="bg-card px-5 py-4">
                <dt className="text-xs text-muted-foreground">{x.k}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums [overflow-wrap:anywhere]">{x.v}</dd>
              </div>
            ))}
          </dl>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              <DatasetMapPanel dataset={d} />

              <section id="timeline" className="scroll-mt-4 overflow-hidden rounded-xl border bg-card">
                <div role="tablist" aria-label="Related records and context" className="flex overflow-x-auto border-b px-2">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active === t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium",
                        active === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                      {t.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{t.count}</span>}
                    </button>
                  ))}
                </div>
                <div role="tabpanel">
                  {active === "overlap" && (
                    <>
                      {related.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-muted-foreground">
                          {d.kind === "drone" ? "No ground plots fall inside this footprint yet." : "No drone missions cover this plot yet."}
                        </p>
                      ) : (
                        <ul>{related.map((r) => <RecordLink key={r.id} r={r} note={companion(r) ? "Companion flight" : undefined} />)}</ul>
                      )}
                      <p className="border-t px-5 py-3 text-xs text-muted-foreground">
                        Plots can sit up to about 10 m off the imagery because of GPS error, so records within 10 m count as overlapping.
                      </p>
                    </>
                  )}
                  {active === "timeline" && d.kind === "ground" && <TimelineBody plot={d} flights={flights} />}
                  {active === "compare" && <ComparePanel d={d} bare />}
                  {active === "pair" && <SitePanel d={d} bare />}
                  {active === "nearby" && (
                    <ul>
                      {nearby.map(({ x, km }) => (
                        <RecordLink key={x.id} r={x} note={[kmLabel(km), companion(x) ? "Companion flight" : ""].filter(Boolean).join(" · ")} />
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <UsePanel d={d} trustOpen={trustOpen} setTrustOpen={setTrustOpen} />

              <Panel title="Downloads and access">
                <ul>
                  {files.map((f) => (
                    <li key={f.name} className="flex items-center gap-3 border-b border-border/60 px-5 py-2.5 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">{f.format}</div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="h-8 px-3" aria-label={`Download ${f.name}`}>
                        <a href={f.url}>Download</a>
                      </Button>
                    </li>
                  ))}
                </ul>
                {d.kind === "drone" && <ImageryList id={d.id} />}
                <details className="group border-t">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">Access with code</span>
                    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="border-t">
                    <div role="tablist" className="flex gap-1 px-5 pt-3">
                      {([["python", "Python"], ["json", "Metadata URL"]] as const).map(([k, label]) => (
                        <button
                          key={k}
                          role="tab"
                          aria-selected={codeTab === k}
                          onClick={() => setCodeTab(k)}
                          className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", codeTab === k ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <pre className="mt-3 bg-surface px-5 py-4 font-mono text-[12.5px] leading-[1.65] whitespace-pre-wrap [overflow-wrap:anywhere]">{code}</pre>
                    <div className="flex justify-end border-t px-5 py-2.5">
                      <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => copy(code, "code")}>
                        {copied === "code" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </details>
              </Panel>
            </div>
          </div>
        </div>
      </div>
      {dockOpen && (
        <div className="max-md:fixed max-md:inset-x-0 max-md:top-[var(--nav-h)] max-md:bottom-0 max-md:z-[1080] md:flex md:shrink-0">
          <AssistantDock />
        </div>
      )}
    </div>
  );
}
