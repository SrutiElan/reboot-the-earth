"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { LayersIcon, XIcon } from "lucide-react";
import type { Geometry } from "geojson";
import type { Dataset, DroneMission } from "@/lib/catalog";
import { apiJson, datasetFileUrl } from "@/lib/api";
import { formatDate } from "@/lib/catalog/format";
import {
  MAGMA, RASTERS, TREE_COLOR_OPTIONS, VIRIDIS, gradient, rasterRange, rasterTemplate, treeStyle,
  type RasterKey, type TreeColorBy,
} from "@/lib/catalog/overlays";
import { cn } from "@/lib/utils";
import { BASEMAPS, type Basemap } from "./map-style";
import { useCatalog } from "./catalog-provider";
import type { MapOverlays, TreeFeature } from "./dataset-map";

const DatasetMap = dynamic(() => import("./dataset-map"), { ssr: false });

interface Imagery {
  available: boolean | null;
  products: { key: string; label: string; url: string; bytes: number }[];
}

/** Loads something for a key and ignores stale responses; the key is null when nothing should load. */
function useLoaded<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data?: T; failed?: boolean }>({ key: null });
  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    load(abort.signal)
      .then((data) => setState({ key, data }))
      .catch(() => !abort.signal.aborted && setState({ key, failed: true }));
    return () => abort.abort();
    // `load` is rebuilt every render; the key says when the request actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key ? state : null;
  return { data: current?.data, failed: !!current?.failed, loading: key !== null && !current };
}

function coordinates(g: Geometry | null): number[][] {
  if (!g) return [];
  const walk = (c: unknown): number[][] => (Array.isArray(c) && typeof c[0] === "number" ? [c as number[]] : Array.isArray(c) ? c.flatMap(walk) : []);
  return g.type === "GeometryCollection" ? g.geometries.flatMap((x) => coordinates(x)) : walk(g.coordinates);
}

function boundsOf(d: Dataset): [[number, number], [number, number]] | null {
  const pts = coordinates(d.geometry);
  if (!pts.length) return null;
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
}

export function DatasetMapPanel({ dataset }: { dataset: Dataset }) {
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(true);
  const [basemap, setBasemap] = useState<Basemap>("topo");
  const [raster, setRaster] = useState<RasterKey | "none">("none");
  const [opacity, setOpacity] = useState(0.85);
  const [showTrees, setShowTrees] = useState(true);
  const [colorBy, setColorBy] = useState<TreeColorBy>("species");
  const [chosen, setChosen] = useState<string | null>(null);

  // Missions that can supply imagery: this one, or every mission over this plot.
  const missions = useMemo<DroneMission[]>(
    () =>
      dataset.kind === "drone"
        ? [dataset]
        : dataset.overlaps.map((id) => catalog.byId(id)).filter((m): m is DroneMission => m?.kind === "drone").sort((a, b) => b.date.localeCompare(a.date)),
    [catalog, dataset],
  );
  const mission = missions.find((m) => m.id === chosen) ?? missions[0] ?? null;

  const imagery = useLoaded<Imagery>(mission ? mission.id : null, (signal) => apiJson<Imagery>(`/api/catalog/datasets/${encodeURIComponent(mission!.id)}/imagery`, { signal }));
  const spec = RASTERS.find((r) => r.key === raster) ?? null;
  const product = spec ? imagery.data?.products.find((p) => p.key === spec.key) : undefined;
  const range = useLoaded<[number, number]>(product && spec?.colormap ? product.url : null, (signal) => rasterRange(product!.url, signal));

  // Plot trees; for a mission, the trees of the plots inside it.
  const plots = dataset.kind === "ground" ? [dataset.id] : dataset.overlaps.filter((id) => id.startsWith("ground-")).slice(0, 4);
  const trees = useLoaded<TreeFeature[]>(plots.length ? plots.join(",") : null, async (signal) => {
    const sets = await Promise.all(plots.map((id) => fetch(datasetFileUrl(id, "trees.geojson"), { signal }).then((r) => (r.ok ? r.json() : { features: [] }))));
    return sets.flatMap((s) => (s.features ?? []) as TreeFeature[]).filter((f) => f.geometry?.type === "Point");
  });
  const style = useMemo(() => (trees.data ? treeStyle(trees.data.map((f) => f.properties), colorBy) : null), [trees.data, colorBy]);

  const rasterReady = product && spec && (!spec.colormap || range.data);
  const overlays: MapOverlays = {
    basemap,
    raster: rasterReady ? { template: rasterTemplate(product.url, spec, range.data ?? null), opacity, bounds: boundsOf(mission!) } : null,
    trees: showTrees && trees.data?.length && style ? { features: trees.data, style } : null,
  };

  const rasterNote =
    raster === "none" ? null
    : !mission ? "No drone mission covers this record."
    : imagery.loading ? "Looking up imagery…"
    : imagery.failed || imagery.data?.available === null ? "The imagery bucket could not be reached."
    : !product ? "This mission has no public file for that layer."
    : range.loading ? "Reading the value range…"
    : range.failed ? "Could not read this layer."
    : null;

  return (
    <div className="relative isolate h-[30rem] overflow-hidden rounded-xl border bg-surface">
      <DatasetMap dataset={dataset} overlays={overlays} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Hide map layers" : "Show map layers"}
        className="absolute top-3 right-3 z-[1000] flex h-8 items-center gap-1.5 rounded-lg border bg-popover px-2.5 text-xs font-medium shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      >
        {open ? <XIcon className="size-3.5" /> : <LayersIcon className="size-3.5" />}
        Layers
      </button>

      {open && (
        <div className="absolute top-14 right-3 bottom-3 z-[1000] flex w-[236px] flex-col gap-3.5 overflow-y-auto rounded-lg border bg-popover p-3 text-xs shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 font-semibold">Basemap</legend>
            <div role="radiogroup" className="flex rounded-md bg-muted p-[3px]">
              {(Object.keys(BASEMAPS) as Basemap[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={basemap === k} onClick={() => setBasemap(k)}
                  className={cn("flex-1 rounded px-2 py-1", basemap === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
                  {BASEMAPS[k].label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 font-semibold">Drone imagery</legend>
            {missions.length > 1 && (
              <select aria-label="Mission" value={mission?.id ?? ""} onChange={(e) => setChosen(e.target.value)} className="h-8 rounded-md border bg-background px-1.5">
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>{formatDate(m.date)} · {m.oblique ? "oblique" : "nadir"}{m.altitudeM ? `, ${m.altitudeM} m` : ""}</option>
                ))}
              </select>
            )}
            {[{ key: "none" as const, label: "None", what: "" }, ...RASTERS].map((r) => (
              <label key={r.key} className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="raster" className="mt-0.5" checked={raster === r.key} onChange={() => setRaster(r.key)} />
                <span>
                  <span className="block font-medium">{r.label}</span>
                  {r.what && <span className="block text-muted-foreground">{r.what}</span>}
                </span>
              </label>
            ))}
            {raster !== "none" && (
              <label className="mt-0.5 flex items-center gap-2">
                <span className="text-muted-foreground">Opacity</span>
                <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(+e.target.value)} className="min-w-0 flex-1" />
              </label>
            )}
            {rasterNote && <p className="text-muted-foreground" role="status">{rasterNote}</p>}
            {rasterReady && spec?.colormap && range.data && (
              <div aria-label={`${spec.label} legend`}>
                <div className="h-2.5 rounded-sm" style={{ background: gradient(spec.colormap === "viridis" ? VIRIDIS : MAGMA) }} />
                <div className="mt-1 flex justify-between text-muted-foreground tabular-nums"><span>{range.data[0]} {spec.unit}</span><span>{range.data[1]} {spec.unit}</span></div>
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 font-semibold">Measured trees</legend>
            {plots.length === 0 ? (
              <p className="text-muted-foreground">No ground plot to take trees from.</p>
            ) : trees.loading ? (
              <p className="text-muted-foreground">Loading trees…</p>
            ) : trees.failed || !trees.data?.length ? (
              <p className="text-muted-foreground">No mapped trees for this record.</p>
            ) : (
              <>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={showTrees} onChange={(e) => setShowTrees(e.target.checked)} />
                  <span className="font-medium">Show {trees.data.length.toLocaleString()} trees</span>
                </label>
                {showTrees && style && (
                  <>
                    <select aria-label="Color trees by" value={colorBy} onChange={(e) => setColorBy(e.target.value as TreeColorBy)} className="h-8 rounded-md border bg-background px-1.5">
                      {TREE_COLOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>Color by {o.label.toLowerCase()}</option>)}
                    </select>
                    {style.legend.kind === "classes" ? (
                      <ul aria-label="Tree legend" className="grid grid-cols-2 gap-x-2 gap-y-1">
                        {style.legend.items.map((i) => (
                          <li key={i.label} className="flex items-center gap-1.5"><span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} />{i.label}</li>
                        ))}
                      </ul>
                    ) : (
                      <div aria-label="Tree legend">
                        <div className="h-2.5 rounded-sm" style={{ background: gradient(style.legend.stops) }} />
                        <div className="mt-1 flex justify-between text-muted-foreground tabular-nums"><span>{style.legend.min} {style.legend.unit}</span><span>{style.legend.max} {style.legend.unit}</span></div>
                      </div>
                    )}
                    <p className="text-muted-foreground">Bigger dots are thicker trunks.</p>
                  </>
                )}
              </>
            )}
          </fieldset>
        </div>
      )}
    </div>
  );
}
