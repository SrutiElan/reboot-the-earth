"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import L from "leaflet";
import type { Dataset } from "@/lib/catalog";
import { BASEMAPS, BASEMAP_ATTRIBUTION, datasetBounds, datasetShape, hasLocation, mapColors } from "./map-style";
import { useCatalog } from "./catalog-provider";

// A dataset's own footprint or point, plus everything it overlaps.
export default function DatasetMap({ dataset }: { dataset: Dataset }) {
  const { catalog } = useCatalog();
  const el = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    if (!el.current || !hasLocation(dataset)) return;
    const c = mapColors(dark);
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer(BASEMAPS.topo.url, { maxZoom: BASEMAPS.topo.maxZoom, attribution: BASEMAP_ATTRIBUTION }).addTo(m);
    const items = [dataset, ...dataset.overlaps.map((id) => catalog.byId(id)).filter((d): d is Dataset => !!d)].filter(hasLocation);
    // Initialize the view before adding polygon renderers (Leaflet needs bounds).
    const bounds = datasetBounds(items);
    if (items.length === 1 && dataset.kind === "ground") m.setView([dataset.lat, dataset.lng], 15);
    else if (bounds.isValid()) m.fitBounds(bounds.pad(0.25), { maxZoom: 16 });
    else m.setView([dataset.lat, dataset.lng], 15);
    // Footprints first so plot points draw on top.
    for (const d of [...items.filter((x) => x.kind === "drone"), ...items.filter((x) => x.kind === "ground")]) {
      const layer = datasetShape(d, c, d.id === dataset.id).bindTooltip(d.name, { sticky: d.kind === "drone" }).addTo(m);
      if (d.id !== dataset.id) layer.on("click", () => router.push(`/data/datasets/${d.id}`));
    }
    return () => {
      m.remove();
    };
  }, [catalog, dataset, dark, router]);

  return <div ref={el} className="absolute inset-0" />;
}
