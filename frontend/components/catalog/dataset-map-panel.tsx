"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { LayersIcon } from "lucide-react";
import type { Geometry } from "geojson";
import type { Dataset, DroneMission } from "@/lib/catalog";
import { apiJson, datasetFileUrl } from "@/lib/api";
import { formatDate } from "@/lib/catalog/format";
import {
  MAGMA, RASTERS, TREE_COLOR_OPTIONS, VIRIDIS, gradient, rasterRange, rasterTemplate, treeStyle,
  type RasterKey, type RasterSpec, type TreeColorBy,
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

/** Stacking order, bottom to top: the photo sits under the two measured surfaces. */
const STACK: RasterKey[] = ["ortho", "dsm", "chm"];

export function DatasetMapPanel({ dataset }: { dataset: Dataset }) {
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(true);
  const [basemap, setBasemap] = useState<Basemap>("topo");
  const [on, setOn] = useState<Record<RasterKey, boolean>>({ ortho: false, chm: false, dsm: false });
  const [opacity, setOpacity] = useState<Record<RasterKey, number>>({ ortho: 1, chm: 0.8, dsm: 0.7 });
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
  const anyRaster = on.ortho || on.chm || on.dsm;

  const imagery = useLoaded<Imagery>(mission && anyRaster ? mission.id : null, (signal) => apiJson<Imagery>(`/api/catalog/datasets/${encodeURIComponent(mission!.id)}/imagery`, { signal }));
  const productOf = (key: RasterKey) => imagery.data?.products.find((p) => p.key === key);
  // One value-range lookup per coloured layer (a fixed pair, so the hooks keep their order).
  const chmUrl = on.chm ? productOf("chm")?.url : undefined;
  const dsmUrl = on.dsm ? productOf("dsm")?.url : undefined;
  const chmRange = useLoaded<[number, number]>(chmUrl ?? null, (signal) => rasterRange(chmUrl!, signal));
  const dsmRange = useLoaded<[number, number]>(dsmUrl ?? null, (signal) => rasterRange(dsmUrl!, signal));
  const ranges = { ortho: null, chm: chmRange, dsm: dsmRange };

  // Plot trees; for a mission, the trees of the plots inside it.
  const plots = dataset.kind === "ground" ? [dataset.id] : dataset.overlaps.filter((id) => id.startsWith("ground-")).slice(0, 4);
  const trees = useLoaded<TreeFeature[]>(plots.length ? plots.join(",") : null, async (signal) => {
    const sets = await Promise.all(plots.map((id) => fetch(datasetFileUrl(id, "trees.geojson"), { signal }).then((r) => (r.ok ? r.json() : { features: [] }))));
    return sets.flatMap((s) => (s.features ?? []) as TreeFeature[]).filter((f) => f.geometry?.type === "Point");
  });
  const style = useMemo(() => (trees.data ? treeStyle(trees.data.map((f) => f.properties), colorBy) : null), [trees.data, colorBy]);

  const bounds = mission ? boundsOf(mission) : null;
  const rasters = STACK.flatMap((key) => {
    const spec = RASTERS.find((r) => r.key === key)!;
    const product = on[key] ? productOf(key) : undefined;
    const range = ranges[key]?.data ?? null;
    if (!product || (spec.colormap && !range)) return [];
    return [{ template: rasterTemplate(product.url, spec, range), opacity: opacity[key], bounds }];
  });
  const overlays: MapOverlays = {
    basemap,
    rasters,
    trees: showTrees && trees.data?.length && style ? { features: trees.data, style } : null,
  };

  const rasterNote = (spec: RasterSpec): string | null => {
    if (!on[spec.key]) return null;
    if (!mission) return "No drone mission covers this record.";
    if (imagery.loading) return "Looking up imagery…";
    if (imagery.failed || imagery.data?.available === null) return "The imagery bucket could not be reached.";
    if (!productOf(spec.key)) return "This mission has no public file for this layer.";
    const range = ranges[spec.key];
    if (range?.loading) return "Reading the value range…";
    if (range?.failed) return "Could not read this layer.";
    return null;
  };

  return (
    <div className="relative isolate h-[30rem] overflow-hidden rounded-xl border bg-surface">
      <DatasetMap dataset={dataset} overlays={overlays} />

      {/* One box: collapsed it is just the layers icon; open, the same icon sits in the header and closes it. */}
      <div
        className={cn(
          "absolute top-3 right-3 z-[1000] flex max-h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border bg-popover text-xs shadow-[0_2px_8px_rgba(0,0,0,0.12)]",
          open && "w-[248px]",
        )}
      >
        <div className="flex shrink-0 items-center">
          {open && <span className="flex-1 pl-3 text-[13px] font-semibold">Map layers</span>}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Hide map layers" : "Show map layers"}
            title={open ? "Hide map layers" : "Map layers"}
            className={cn(
              "flex size-[30px] shrink-0 items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              open && "text-foreground",
            )}
          >
            <LayersIcon className="size-4" aria-hidden />
          </button>
        </div>

        {open && (
          <div className="flex flex-col gap-4 overflow-y-auto border-t p-3">
            <div role="radiogroup" aria-label="Basemap" className="flex rounded-md bg-muted p-[3px]">
              {(Object.keys(BASEMAPS) as Basemap[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={basemap === k} onClick={() => setBasemap(k)}
                  className={cn("flex-1 rounded px-2 py-1", basemap === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
                  {BASEMAPS[k].label}
                </button>
              ))}
            </div>

            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-1.5 font-semibold">Drone imagery</legend>
              {missions.length > 1 && (
                <select aria-label="Mission" value={mission?.id ?? ""} onChange={(e) => setChosen(e.target.value)} className="h-8 rounded-md border bg-background px-1.5">
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>{formatDate(m.date)} · {m.oblique ? "oblique" : "nadir"}{m.altitudeM ? `, ${m.altitudeM} m` : ""}</option>
                  ))}
                </select>
              )}
              {RASTERS.map((r) => {
                const note = rasterNote(r);
                const range = ranges[r.key]?.data;
                return (
                  <div key={r.key} className="flex flex-col gap-1.5">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" className="mt-0.5" checked={on[r.key]} onChange={(e) => setOn((o) => ({ ...o, [r.key]: e.target.checked }))} />
                      <span>
                        <span className="block font-medium">{r.label}</span>
                        <span className="block text-muted-foreground">{r.what}</span>
                      </span>
                    </label>
                    {on[r.key] && (
                      <div className="ml-6 flex flex-col gap-1.5">
                        <label className="flex items-center gap-2">
                          <span className="text-muted-foreground">Opacity</span>
                          <input type="range" min={0.2} max={1} step={0.05} value={opacity[r.key]} onChange={(e) => setOpacity((o) => ({ ...o, [r.key]: +e.target.value }))} className="min-w-0 flex-1" />
                        </label>
                        {note && <p className="text-muted-foreground" role="status">{note}</p>}
                        {r.colormap && range && (
                          <div aria-label={`${r.label} legend`}>
                            <div className="h-2.5 rounded-sm" style={{ background: gradient(r.colormap === "viridis" ? VIRIDIS : MAGMA) }} />
                            <div className="mt-1 flex justify-between text-muted-foreground tabular-nums"><span>{range[0]} {r.unit}</span><span>{range[1]} {r.unit}</span></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 font-semibold">Measured trees</legend>
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
                    <div className="ml-6 flex flex-col gap-2">
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
                    </div>
                  )}
                </>
              )}
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}
