import type { Dataset } from ".";
import { datasetFileUrl } from "@/lib/api";

export const plural = (n: number, word: string, many = word + "s") => `${n.toLocaleString()} ${n === 1 ? word : many}`;

export function formatDate(iso: string) {
  if (!iso) return "Unknown date";
  if (iso.length === 4) return iso;
  if (iso.length === 7) return new Date(`${iso}-01T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function areaLabel(d: Dataset) {
  const area = d.kind === "drone" ? d.areaHa : d.plotHa;
  return area == null ? "—" : `${area} ha`;
}

export function cameraLabel(d: Dataset) {
  if (d.kind !== "drone") return "—";
  if (d.cameraPitch === null) return "Unknown";
  return d.oblique ? `Oblique ${Math.round(d.cameraPitch)}°` : "Nadir";
}

export function overlapLabel(d: Dataset) {
  const n = d.overlaps.length;
  if (!n) return "—";
  return plural(n, d.kind === "drone" ? "plot" : "mission");
}

export interface DatasetFile {
  name: string;
  format: string;
  url: string;
}

export function datasetFiles(d: Dataset): DatasetFile[] {
  const files = [
    { name: "Source metadata", format: "JSON", url: datasetFileUrl(d.id, "metadata.json") },
    { name: "Footprint boundary", format: "GeoJSON", url: datasetFileUrl(d.id, "geometry.geojson") },
  ];
  if (d.kind === "ground") files.push(
    { name: "Tree measurements", format: "CSV", url: datasetFileUrl(d.id, "trees.csv") },
    { name: "Tree stem locations", format: "GeoJSON", url: datasetFileUrl(d.id, "trees.geojson") },
  );
  return files;
}
