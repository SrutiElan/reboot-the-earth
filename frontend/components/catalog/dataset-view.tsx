"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronRightIcon, DownloadIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";
import type { Dataset, DroneMission, GroundPlot } from "@/lib/catalog";
import { API_BASE, apiJson, datasetFileUrl } from "@/lib/api";
import { areaLabel, datasetFiles, distanceKm, formatDate, licenseTerms, licenseUrl, plural, protocolLabel } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";
import { KindBadge, KindMark } from "./kind-mark";
import { CatalogSwitcher } from "./catalog-switcher";
import { useCopy } from "./use-copy";

const DatasetMap = dynamic(() => import("./dataset-map"), { ssr: false });

function details(d: Dataset): { k: string; v: string }[] {
  if (d.kind === "drone") {
    return [
      { k: "Site", v: d.site },
      { k: "Aircraft", v: d.aircraft ?? "—" },
      { k: "Camera", v: d.cameraPitch === null ? "—" : `${d.cameraPitch}° (${d.oblique ? "oblique" : "nadir"})` },
    ];
  }
  return [
    { k: "Site", v: d.site },
    { k: "Dominant species", v: d.species ?? "—" },
  ];
}

function pythonFor(d: Dataset) {
  return d.kind === "drone"
    ? `import requests\n\nmetadata = requests.get(\n    "${datasetFileUrl(d.id, "metadata.json")}", timeout=30\n).json()\nprint(metadata)`
    : `import pandas as pd\nimport geopandas as gpd\n\ntrees = pd.read_csv(\n    "${datasetFileUrl(d.id, "trees.csv")}"
)\nstems = gpd.read_file(\n    "${datasetFileUrl(d.id, "trees.geojson")}"
)`;
}

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="flex min-h-[52px] items-center gap-3 border-b px-5 py-2.5">
        <h2 className="flex-1 text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const NEARBY_KM = 5;

function Restrictions({ d }: { d: Dataset }) {
  const [copied, copy] = useCopy();
  const url = licenseUrl(d.license);
  const credit = `${d.contributors ?? "Unknown contributors"}. ${d.name} (${d.id}), Open Forest Observatory. License: ${d.license ?? "not stated"}.`;
  return (
    <Panel title="Data use and restrictions">
      <dl className="grid gap-x-5 gap-y-3.5 p-5 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
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
          <>
            <div>
              <dt className="text-xs text-muted-foreground">Smallest tree measured</dt>
              <dd className="mt-0.5 text-sm font-medium">{protocolLabel(d)}</dd>
            </div>
            {d.hyperplot && (
              <div>
                <dt className="text-xs text-muted-foreground">Hyperplot</dt>
                <dd className="mt-0.5 text-sm font-medium">{d.hyperplot}</dd>
              </div>
            )}
          </>
        )}
      </dl>
      <div className="border-t px-5 py-3 text-[13px] leading-normal text-muted-foreground">
        <p>{licenseTerms(d.license)}</p>
        {d.withheld && <p className="mt-1">This record is reserved for testing machine-learning models; keep it out of training data.</p>}
        {d.kind === "ground" && <p className="mt-1">Trees below these thresholds were not measured, so counts are only complete above them.</p>}
      </div>
      <div className="flex items-start gap-3 border-t px-5 py-3">
        <p className="min-w-0 flex-1 text-xs leading-normal text-muted-foreground">
          <span className="font-medium text-foreground">Credit: </span>
          {credit}
        </p>
        <Button variant="outline" size="sm" className="h-8 shrink-0 px-3" onClick={() => copy(credit, "credit")}>
          {copied === "credit" ? "Copied" : "Copy"}
        </Button>
      </div>
    </Panel>
  );
}

interface Imagery {
  available: boolean | null;
  folder: string | null;
  products: { label: string; url: string; bytes: number }[];
}

const megabytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);

function ImageryPanel({ id }: { id: string }) {
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
    <Panel title="Drone imagery and products">
      {!current ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">Looking up public imagery…</p>
      ) : current.failed || imagery?.available === null ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">The imagery bucket could not be reached right now.</p>
      ) : !imagery?.available ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">No public imagery was found for this mission.</p>
      ) : (
        <>
          <ul>
            {imagery.products.map((p) => (
              <li key={p.url} className="flex items-center gap-3 border-b border-border/60 px-5 py-2.5 last:border-0">
                <span className="min-w-0 flex-1 text-sm font-medium">{p.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{megabytes(p.bytes)}</span>
                <Button asChild variant="outline" size="sm" className="h-8 px-3">
                  <a href={p.url} target="_blank" rel="noreferrer">Open</a>
                </Button>
              </li>
            ))}
          </ul>
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">
            Linked from the public Open Forest Observatory bucket; these files are large and are not downloaded here.{" "}
            {imagery.folder && <a href={imagery.folder} target="_blank" rel="noreferrer" className="underline">Browse all mission files</a>}
          </p>
        </>
      )}
    </Panel>
  );
}

const dayMs = (iso: string) => Date.parse(iso.length === 4 ? `${iso}-07-01` : iso.length === 7 ? `${iso}-15` : iso);

/** One plot's ground survey against every drone flight over it. Ground plots are surveyed once, so this is imagery change over time, not tree growth. */
function TimelinePanel({ plot, flights }: { plot: GroundPlot; flights: DroneMission[] }) {
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
    <section id="timeline" className="scroll-mt-4 overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-[52px] items-center gap-3 border-b px-5 py-2.5">
        <h2 className="flex-1 text-[15px] font-semibold">Timeline over this plot</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{plural(dates.size, "flight date")}</span>
      </div>
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
    </section>
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

export function DatasetView({ id }: { id: string }) {
  const { catalog, catalogLoading, catalogError, reloadCatalog, collection, toggleCollection } = useCatalog();
  const d = catalog.byId(id);
  const [tab, setTab] = useState<"python" | "json">("python");
  const [copied, copy] = useCopy();

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

  if (catalogLoading) return <p className="p-8 text-muted-foreground">Loading dataset…</p>;
  if (catalogError) return <p role="alert" className="p-8">{catalogError} <button type="button" onClick={reloadCatalog} className="underline">Retry</button></p>;
  if (!d) return <p className="p-8">Dataset not found. <Link href="/data/catalog" className="underline">Return to catalog</Link></p>;
  const files = datasetFiles(d);
  const related = d.overlaps.map((x) => catalog.byId(x)).filter((r): r is Dataset => !!r);
  const inCol = collection.includes(d.id);
  const code = tab === "python" ? pythonFor(d) : datasetFileUrl(d.id, "metadata.json");
  const kmLabel = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`);
  // Many sites have a high straight-down flight and a low angled one a few metres apart.
  const companion = (x: Dataset) => d.kind === "drone" && x.kind === "drone" && x.oblique !== d.oblique;
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

  return (
    <div className="flex-1">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-5 pt-4">
        <nav aria-label="Breadcrumb" className="flex flex-1 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/data" className="text-foreground hover:underline">
            Data
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden />
          <Link href="/data/catalog" className="text-foreground hover:underline">
            All datasets
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden />
          <span aria-current="page" className="tabular-nums">
            {d.id}
          </span>
        </nav>
        <CatalogSwitcher />
      </div>

      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 pt-6 pb-20">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2.5">
            <KindBadge kind={d.kind} long />
            <h1 className="text-[clamp(22px,3vw,28px)] leading-tight font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">
              {d.name}
            </h1>
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
              <a href={`${API_BASE}/api/catalog/datasets/${d.id}/download`}><DownloadIcon className="size-[15px]" />Download records (ZIP)</a>
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
            <div className="relative isolate h-[26rem] overflow-hidden rounded-xl border bg-surface">
              <DatasetMap dataset={d} />
            </div>

            {d.kind === "ground" && <TimelinePanel plot={d} flights={related.filter((r): r is DroneMission => r.kind === "drone")} />}

            <Panel title={d.kind === "drone" ? "Ground plots inside this footprint" : "Drone missions covering this plot"}>
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
            </Panel>

            <Panel title={`Nearby datasets (within ${NEARBY_KM} km)`}>
              {nearby.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">Nothing else within {NEARBY_KM} km.</p>
              ) : (
                <ul>
                  {nearby.map(({ x, km }) => (
                    <RecordLink key={x.id} r={x} note={[kmLabel(km), companion(x) && km < 0.2 ? "Companion flight" : ""].filter(Boolean).join(" · ")} />
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Restrictions d={d} />

            <Panel title="Details">
              <dl className="grid gap-x-5 gap-y-3.5 p-5 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]">
                {details(d).map((x) => (
                  <div key={x.k}>
                    <dt className="text-xs text-muted-foreground">{x.k}</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">{x.v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            {d.kind === "drone" && <ImageryPanel id={d.id} />}

            <Panel title="Files">
              <ul>
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 border-b border-border/60 px-5 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{f.name}</div>
                      <div className="mt-px flex gap-2.5 text-xs text-muted-foreground tabular-nums">
                        <span>{f.format}</span>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="h-8 px-3" aria-label={`Download ${f.name}`}>
                      <a href={f.url}>Download</a>
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              title="Access with code"
              action={
                <div role="tablist" className="grid grid-cols-2 rounded-lg bg-muted p-[3px]">
                  {(
                    [
                      ["python", "Python"],
                      ["json", "Metadata URL"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={tab === k}
                      onClick={() => setTab(k)}
                      className={cn(
                        "h-[26px] rounded-md px-2.5 text-[13px] font-medium",
                        tab === k
                          ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.1)] dark:bg-card"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              <pre className="bg-surface px-5 py-4 font-mono text-[12.5px] leading-[1.65] whitespace-pre-wrap [overflow-wrap:anywhere]">
                {code}
              </pre>
              <div className="flex justify-end border-t px-5 py-2.5">
                <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => copy(code, "code")}>
                  {copied === "code" ? "Copied" : "Copy"}
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
