"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ChevronRightIcon, DownloadIcon } from "lucide-react";
import type { Dataset } from "@/lib/catalog";
import { API_BASE, datasetFileUrl } from "@/lib/api";
import { datasetFiles, formatDate, plural } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";
import { KindBadge, KindMark, WithheldBadge } from "./kind-mark";
import { CatalogSwitcher } from "./catalog-switcher";
import { useCopy } from "./use-copy";

const DatasetMap = dynamic(() => import("./dataset-map"), { ssr: false });

function details(d: Dataset): { k: string; v: string }[] {
  if (d.kind === "drone") {
    return [
      { k: "Collected", v: formatDate(d.date) },
      { k: "Site", v: d.site },
      { k: "Aircraft", v: d.aircraft ?? "—" },
      { k: "Area", v: d.areaHa === null ? "—" : `${d.areaHa} ha` },
      { k: "Altitude", v: d.altitudeM ? `${d.altitudeM} m` : "—" },
      { k: "Camera pitch", v: d.cameraPitch === null ? "—" : `${d.cameraPitch}°` },
      { k: "Images", v: d.imageCount?.toLocaleString() ?? "—" },
      { k: "Training use", v: d.withheld ? "Withheld (test set)" : "Available" },
    ];
  }
  return [
    { k: "Surveyed", v: formatDate(d.date) + (d.dateApproximate ? " (approximate)" : "") },
    { k: "Site", v: d.site },
    { k: "Trees mapped", v: d.trees.toLocaleString() },
    { k: "Plot area", v: d.plotHa === null ? "—" : `${d.plotHa} ha` },
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

export function DatasetView({ id }: { id: string }) {
  const { catalog, catalogLoading, catalogError, reloadCatalog, collection, toggleCollection } = useCatalog();
  const d = catalog.byId(id);
  const [tab, setTab] = useState<"python" | "json">("python");
  const [copied, copy] = useCopy();
  if (catalogLoading) return <p className="p-8 text-muted-foreground">Loading dataset…</p>;
  if (catalogError) return <p role="alert" className="p-8">{catalogError} <button type="button" onClick={reloadCatalog} className="underline">Retry</button></p>;
  if (!d) return <p className="p-8">Dataset not found. <Link href="/data/catalog" className="underline">Return to catalog</Link></p>;
  const files = datasetFiles(d);
  const related = d.overlaps.map((x) => catalog.byId(x)).filter((r): r is Dataset => !!r);
  const inCol = collection.includes(d.id);
  const code = tab === "python" ? pythonFor(d) : datasetFileUrl(d.id, "metadata.json");

  return (
    <div className="flex-1">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-3 px-5 pt-4">
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

      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-5 pt-6 pb-20">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="text-[clamp(22px,3vw,28px)] leading-tight font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">
              {d.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
              <KindBadge kind={d.kind} long />
              {d.kind === "drone" && d.withheld && <WithheldBadge long />}
              <span>{d.site}</span>
              <span>{formatDate(d.date)}{d.dateApproximate ? " (approximate)" : ""}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-[38px] px-3.5" onClick={() => toggleCollection(d.id)}>
              {inCol ? "Remove from collection" : "Add to collection"}
            </Button>
            <Button asChild className="h-[38px] gap-2 px-4 hover:bg-primary-hover">
              <a href={`${API_BASE}/api/catalog/datasets/${d.id}/download`}><DownloadIcon className="size-[15px]" />Download records (ZIP)</a>
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel title="Details">
              <dl className="grid gap-x-5 gap-y-3.5 p-5 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                {details(d).map((x) => (
                  <div key={x.k}>
                    <dt className="text-xs text-muted-foreground">{x.k}</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">{x.v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

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
              {d.kind === "drone" && <p className="border-t px-5 py-3 text-xs text-muted-foreground">Available here: imported metadata and footprint. Imagery, orthomosaics and canopy height models are not included in this database.</p>}
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

          <div className="flex min-w-0 flex-col gap-5">
            <div className="relative isolate h-80 overflow-hidden rounded-xl border bg-surface">
              <DatasetMap dataset={d} />
            </div>
            <Panel title={d.kind === "drone" ? "Ground plots inside this footprint" : "Drone missions covering this plot"}>
              {related.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  {d.kind === "drone" ? "No ground plots fall inside this footprint yet." : "No drone missions cover this plot yet."}
                </p>
              ) : (
                <ul>
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/data/datasets/${r.id}`}
                        className="flex items-center gap-2.5 border-b border-border/60 px-5 py-3 outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
                      >
                        <KindMark kind={r.kind} className="size-[9px]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.name}</span>
                          <span className="mt-px flex gap-2.5 text-xs text-muted-foreground tabular-nums">
                            {r.kind === "drone" ? (
                              <>
                                <span>{r.id}</span>
                                <span>{r.date}</span>
                                <span>{r.aircraft}</span>
                              </>
                            ) : (
                              <>
                                <span>{r.date}</span>
                                <span>{plural(r.trees, "tree")}</span>
                              </>
                            )}
                          </span>
                        </span>
                        <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
