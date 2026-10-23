import L from "leaflet";
import type { Dataset } from "@/lib/catalog";

// Esri basemaps need no API key; attribution "Esri" is required.
export const TILES = {
  light: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  dark: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
};

export interface MapColors {
  drone: string;
  ground: string;
  outline: string;
  emphasis: string;
}

export function mapColors(dark: boolean): MapColors {
  return dark
    ? { drone: "#4fb0c6", ground: "#ee8f3e", outline: "#23252f", emphasis: "#ffffff" }
    : { drone: "#006880", ground: "#d9731a", outline: "#ffffff", emphasis: "#1b2420" };
}

export type DatasetLayer = L.Rectangle | L.CircleMarker;

export function datasetShape(d: Dataset, c: MapColors, strong = false): DatasetLayer {
  if (d.kind === "drone") {
    return L.rectangle(
      [
        [d.lat - d.dLat, d.lng - d.dLng],
        [d.lat + d.dLat, d.lng + d.dLng],
      ],
      { color: c.drone, weight: strong ? 2.5 : 1.2, fillOpacity: strong ? 0.22 : 0.06 },
    );
  }
  return L.circleMarker([d.lat, d.lng], {
    radius: strong ? 8 : 6,
    color: strong ? c.emphasis : c.outline,
    weight: 2,
    fillColor: c.ground,
    fillOpacity: 1,
  });
}

export function setEmphasis(layer: DatasetLayer, d: Dataset, c: MapColors, on: boolean) {
  if (d.kind === "drone") layer.setStyle({ weight: on ? 2.5 : 1.2, fillOpacity: on ? 0.25 : 0.06 });
  else (layer as L.CircleMarker).setStyle({ color: on ? c.emphasis : c.outline }).setRadius(on ? 8 : 6);
  if (on) layer.bringToFront();
}

export function datasetBounds(items: Dataset[]) {
  const b = L.latLngBounds([]);
  for (const d of items) {
    if (d.kind === "drone") {
      b.extend([d.lat - d.dLat, d.lng - d.dLng]);
      b.extend([d.lat + d.dLat, d.lng + d.dLng]);
    } else b.extend([d.lat, d.lng]);
  }
  return b;
}
