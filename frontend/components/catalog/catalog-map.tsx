"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import L from "leaflet";
import type { Dataset } from "@/lib/catalog";
import { useCatalog } from "./catalog-provider";
import { BASEMAPS, BASEMAP_ATTRIBUTION, datasetBounds, datasetShape, hasLocation, mapColors, setEmphasis, type Basemap, type DatasetLayer } from "./map-style";

const DEFAULT_VIEW = { center: [39.0, -121.2] as [number, number], zoom: 6 };
const DETAIL_ZOOM = 11;
const CLUSTER_PX = 80;

// Last fit request the map acted on. Module scope so it survives the map
// unmounting while a dataset page is open.
let fitHandled = 0;
let lastBasemap: Basemap = "topo";

function clusterHtml(drones: number, grounds: number, c: ReturnType<typeof mapColors>) {
  const seg = (n: number, color: string, radius: string) =>
    n
      ? `<span style="display:flex;align-items:center;gap:5px;padding:2px 8px 2px 6px"><span style="width:8px;height:8px;border-radius:${radius};background:${color}"></span>${n}</span>`
      : "";
  return `<div class="ofo-cluster-pill" style="position:absolute;transform:translate(-50%,-50%);display:flex;background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border);border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.14);font:600 12px/1.2 var(--font-sans);font-variant-numeric:tabular-nums;padding:3px;white-space:nowrap;cursor:pointer">${seg(drones, c.drone, "2px")}${seg(grounds, c.ground, "999px")}</div>`;
}

export default function CatalogMap() {
  const { results: allResults, setBounds, getMapView, saveMapView, fitToken, hoverId, setHoverId } = useCatalog();
  const results = useMemo(() => allResults.filter(hasLocation), [allResults]);
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const group = useRef<L.LayerGroup | null>(null);
  const shapes = useRef<Map<string, { layer: DatasetLayer; d: Dataset }>>(new Map());
  const [basemap, setBasemap] = useState<Basemap>(lastBasemap);
  const [zoomTick, setZoomTick] = useState(0);
  const onZoom = useCallback(() => setZoomTick((z) => z + 1), []);
  const dark = resolvedTheme === "dark";

  // Create the map once; restore the last view when coming back from a dataset page.
  useEffect(() => {
    if (!el.current) return;
    const saved = getMapView();
    const m = L.map(el.current, { zoomControl: false });
    if (saved) m.setView(saved.center, saved.zoom);
    else m.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    group.current = L.layerGroup().addTo(m);
    const report = () => {
      const b = m.getBounds();
      setBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
      const c = m.getCenter();
      saveMapView({ center: [c.lat, c.lng], zoom: m.getZoom() });
    };
    m.on("moveend", report);
    m.on("zoomend", onZoom);
    map.current = m;
    // The container may not have its final size yet, so fit on the next frame.
    const frame = requestAnimationFrame(() => {
      m.invalidateSize();
      if (!saved && results.length) m.fitBounds(datasetBounds(results).pad(0.1));
      report();
    });
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      m.remove();
      map.current = null;
    };
      // Created once; later changes to these callbacks don't need a new map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current) return;
    tiles.current?.remove();
    lastBasemap = basemap;
    tiles.current = L.tileLayer(BASEMAPS[basemap].url, { attribution: BASEMAP_ATTRIBUTION, maxZoom: BASEMAPS[basemap].maxZoom }).addTo(map.current);
    tiles.current.bringToBack();
  }, [basemap]);

  // Draw clusters when zoomed out, footprints and plot points when zoomed in.
  useEffect(() => {
    const m = map.current;
    const g = group.current;
    if (!m || !g) return;
    const c = mapColors(dark);
    g.clearLayers();
    shapes.current.clear();

    if (m.getZoom() < DETAIL_ZOOM) {
      const clusters: { pt: L.Point; items: (Dataset & { lat: number; lng: number })[] }[] = [];
      for (const d of results) {
        const pt = m.latLngToLayerPoint([d.lat, d.lng]);
        const hit = clusters.find((cl) => cl.pt.distanceTo(pt) < CLUSTER_PX);
        if (hit) hit.items.push(d);
        else clusters.push({ pt, items: [d] });
      }
      for (const { items } of clusters) {
        const drones = items.filter((d) => d.kind === "drone").length;
        const lat = items.reduce((a, d) => a + d.lat, 0) / items.length;
        const lng = items.reduce((a, d) => a + d.lng, 0) / items.length;
        const sites = [...new Set(items.map((d) => d.site))];
        L.marker([lat, lng], {
          icon: L.divIcon({ className: "ofo-cluster", html: clusterHtml(drones, items.length - drones, c), iconSize: [0, 0] }),
          keyboard: true,
          title: `${items.length} datasets`,
        })
          .bindTooltip(sites.slice(0, 3).join(", ") + (sites.length > 3 ? ", and more" : ""), {
            direction: "top",
            offset: [0, -14],
          })
          .on("click", () => {
            if (items.length > 1) m.fitBounds(datasetBounds(items).pad(0.3), { maxZoom: 14 });
            else router.push(`/data/datasets/${items[0].id}`);
          })
          .addTo(g);
      }
      return;
    }

    for (const d of results) {
      const layer = datasetShape(d, c)
        .bindTooltip(d.name, { sticky: d.kind === "drone", direction: "top" })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          router.push(`/data/datasets/${d.id}`);
        })
        .on("mouseover", () => setHoverId(d.id))
        .on("mouseout", () => setHoverId(null))
        .addTo(g);
      shapes.current.set(d.id, { layer, d });
    }
    // Plot points sit above footprints so they stay clickable.
    shapes.current.forEach(({ layer, d }) => d.kind === "ground" && layer.bringToFront());
  }, [results, zoomTick, dark, router, setHoverId]);

  // Highlight the hovered dataset, whether the hover came from the map or the table.
  useEffect(() => {
    if (!hoverId) return;
    const s = shapes.current.get(hoverId);
    if (!s) return;
    const c = mapColors(dark);
    setEmphasis(s.layer, s.d, c, true);
    return () => setEmphasis(s.layer, s.d, c, false);
  }, [hoverId, dark, zoomTick, results]);

  // Zoom to the results after a place search or an assistant answer.
  useEffect(() => {
    if (!map.current || fitToken === fitHandled) return;
    const m = map.current;
    const frame = requestAnimationFrame(() => {
      fitHandled = fitToken;
      m.invalidateSize();
      if (results.length) m.fitBounds(datasetBounds(results).pad(0.2), { maxZoom: 13 });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitToken, results]);

  return (
    <>
      <div ref={el} className="absolute inset-0" />
      <div role="radiogroup" aria-label="Basemap" className="absolute top-3 right-3 z-[1000] flex rounded-lg border bg-popover p-[3px] text-xs shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {(Object.keys(BASEMAPS) as Basemap[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={basemap === k}
            onClick={() => setBasemap(k)}
            className={basemap === k ? "rounded-md bg-muted px-2 py-1 font-medium text-foreground" : "rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"}
          >
            {BASEMAPS[k].label}
          </button>
        ))}
      </div>
    </>
  );
}
