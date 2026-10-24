"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import type { Feature, Point } from "geojson";
import type { Dataset } from "@/lib/catalog";
import type { TreeProps, TreeStyle } from "@/lib/catalog/overlays";
import { useTheme } from "next-themes";
import { BASEMAPS, BASEMAP_ATTRIBUTION, datasetBounds, datasetShape, hasLocation, nearbyShape, mapColors, type Basemap } from "./map-style";
import { useCatalog } from "./catalog-provider";

export type TreeFeature = Feature<Point, TreeProps>;

export interface MapOverlays {
  basemap: Basemap;
  /** Bottom to top. */
  rasters: { template: string; opacity: number; bounds: [[number, number], [number, number]] | null }[];
  trees: { features: TreeFeature[]; style: TreeStyle } | null;
}

// A dataset's own footprint or point, everything it overlaps, and the optional raster and tree overlays.
export default function DatasetMap({ dataset, overlays, nearby = [] }: { dataset: Dataset; overlays: MapOverlays; nearby?: Dataset[] }) {
  const { catalog } = useCatalog();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    if (!el.current || !hasLocation(dataset)) return;
    const c = mapColors(dark);
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    const items = [dataset, ...dataset.overlaps.map((id) => catalog.byId(id)).filter((d): d is Dataset => !!d)].filter(hasLocation);
    // Initialize the view before adding polygon renderers (Leaflet needs bounds).
    const bounds = datasetBounds(items);
    if (items.length === 1 && dataset.kind === "ground") m.setView([dataset.lat, dataset.lng], 15);
    else if (bounds.isValid()) m.fitBounds(bounds.pad(0.25), { maxZoom: 16 });
    else m.setView([dataset.lat, dataset.lng], 15);
    // Nearby records go underneath as dashed outlines; they stay out of the fitted view.
    for (const d of nearby.filter(hasLocation)) {
      nearbyShape(d, c).bindTooltip(d.name, { sticky: d.kind === "drone" }).on("click", () => router.push(`/data/datasets/${d.id}`)).addTo(m);
    }
    // Footprints first so plot points draw on top.
    for (const d of [...items.filter((x) => x.kind === "drone"), ...items.filter((x) => x.kind === "ground")]) {
      const layer = datasetShape(d, c, d.id === dataset.id).bindTooltip(d.name, { sticky: d.kind === "drone" }).addTo(m);
      if (d.id !== dataset.id) layer.on("click", () => router.push(`/data/datasets/${d.id}`));
    }
    map.current = m;
    return () => {
      map.current = null;
      m.remove();
    };
  }, [catalog, dataset, nearby, dark, router]);

  // Basemap, raster and trees redraw without rebuilding the map. They share the map effect's deps so they
  // are re-added whenever the map is recreated.
  const { basemap, rasters, trees } = overlays;
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const layers: L.Layer[] = [];
    const base = BASEMAPS[basemap];
    layers.push(L.tileLayer(base.url, { attribution: BASEMAP_ATTRIBUTION, maxNativeZoom: base.maxZoom, maxZoom: 21, zIndex: 1 }).addTo(m));
    rasters.forEach((raster, i) => {
      layers.push(
        L.tileLayer(raster.template, {
          opacity: raster.opacity,
          maxZoom: 21,
          zIndex: 5 + i,
          bounds: raster.bounds ?? undefined,
          attribution: "Imagery © Open Forest Observatory contributors",
        }).addTo(m),
      );
    });
    if (trees) {
      const layer = L.geoJSON(trees.features, {
        pointToLayer: (f, latlng) => {
          const p = f.properties as TreeProps;
          return L.circleMarker(latlng, { radius: trees.style.radius(p), fillColor: trees.style.color(p), fillOpacity: 0.92, color: "#fff", weight: 1 });
        },
        onEachFeature: (f, l) => {
          const p = f.properties as TreeProps;
          const bits = [p.species_code, p.dbh ? `${Math.round(p.dbh * 10) / 10} cm DBH` : null, p.height ? `${Math.round(p.height * 10) / 10} m tall` : null];
          l.bindTooltip(bits.filter(Boolean).join(" · ") || "Tree", { direction: "top" });
        },
      }).addTo(m);
      layers.push(layer);
    }
    return () => layers.forEach((l) => l.remove());
  }, [catalog, dataset, dark, router, basemap, rasters, trees]);

  return <div ref={el} className="absolute inset-0" />;
}
