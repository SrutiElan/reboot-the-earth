"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import L from "leaflet";
import { catalog, type Dataset } from "@/lib/catalog";
import { datasetBounds, datasetShape, mapColors, TILES } from "./map-style";

// A dataset's own footprint or point, plus everything it overlaps.
export default function DatasetMap({ dataset }: { dataset: Dataset }) {
  const el = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    if (!el.current) return;
    const c = mapColors(dark);
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer(dark ? TILES.dark : TILES.light, { maxZoom: 16 }).addTo(m);
    const items = [dataset, ...dataset.overlaps.map((id) => catalog.byId(id)!)];
    // Footprints first so plot points draw on top.
    for (const d of [...items.filter((x) => x.kind === "drone"), ...items.filter((x) => x.kind === "ground")]) {
      const layer = datasetShape(d, c, d.id === dataset.id).bindTooltip(d.name, { sticky: d.kind === "drone" }).addTo(m);
      if (d.id !== dataset.id) layer.on("click", () => router.push(`/data/datasets/${d.id}`));
    }
    if (items.length === 1 && dataset.kind === "ground") m.setView([dataset.lat, dataset.lng], 15);
    else m.fitBounds(datasetBounds(items).pad(0.25), { maxZoom: 16 });
    return () => {
      m.remove();
    };
  }, [dataset, dark, router]);

  return <div ref={el} className="absolute inset-0" />;
}
