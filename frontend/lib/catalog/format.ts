import type { Dataset } from ".";

export const plural = (n: number, word: string, many = word + "s") => `${n.toLocaleString()} ${n === 1 ? word : many}`;

export function formatSize(gb: number) {
  if (gb < 0.001) return Math.max(1, Math.round(gb * 1048576)) + " KB";
  if (gb < 1) return Math.max(1, Math.round(gb * 1024)) + " MB";
  return gb.toFixed(1) + " GB";
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function areaLabel(d: Dataset) {
  return `${d.kind === "drone" ? d.areaHa : d.plotHa} ha`;
}

export function cameraLabel(d: Dataset) {
  if (d.kind !== "drone") return "—";
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
  gb: number;
}

// Illustrative sizes until the backend reports real asset sizes.
export function datasetFiles(d: Dataset): DatasetFile[] {
  if (d.kind === "drone") {
    return [
      { name: "Raw images", format: "ZIP", gb: d.imageCount * 0.011 },
      { name: "Orthomosaic", format: "Cloud-optimized GeoTIFF", gb: d.areaHa * 0.085 },
      { name: "Canopy height model", format: "GeoTIFF", gb: d.areaHa * 0.012 },
      { name: "Tree detections", format: "GeoPackage", gb: d.areaHa * 0.0006 },
    ];
  }
  return [
    { name: "Tree list", format: "CSV", gb: d.trees * 0.0000002 },
    { name: "Stem map", format: "GeoPackage", gb: d.trees * 0.000001 },
    { name: "Plot boundary", format: "GeoJSON", gb: 0.000004 },
  ];
}
