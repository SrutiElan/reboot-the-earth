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

export type DatasetLayer = L.GeoJSON | L.CircleMarker;

export function hasLocation(d: Dataset): d is Dataset & { lat: number; lng: number } {
  return d.lat !== null && d.lng !== null && Number.isFinite(d.lat) && Number.isFinite(d.lng);
}

export function datasetShape(d: Dataset, c: MapColors, strong = false): DatasetLayer {
  if (d.kind === "drone" && d.geometry) {
    return L.geoJSON(d.geometry, { style: { color: c.drone, weight: strong ? 2.5 : 1.2, fillOpacity: strong ? 0.22 : 0.06 } });
  }
  if (!hasLocation(d)) throw new Error("Dataset has no mapped location");
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
    if (d.geometry) {
      const bounds = L.geoJSON(d.geometry).getBounds();
      if (bounds.isValid()) b.extend(bounds);
    } else if (hasLocation(d)) b.extend([d.lat, d.lng]);
  }
  return b;
}
