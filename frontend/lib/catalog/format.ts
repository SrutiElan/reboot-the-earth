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

/** Link to the Creative Commons deed for a license string such as "CC BY SA 4.0". */
export function licenseUrl(license: string | null): string | null {
  if (!license) return null;
  if (/^cc0/i.test(license)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  if (/public domain/i.test(license)) return "https://creativecommons.org/publicdomain/mark/1.0/";
  const m = license.match(/^CC[ -]BY((?: (?:NC|SA|ND))*) (\d\.\d)$/i);
  if (!m) return null;
  const parts = m[1].trim().toLowerCase().split(" ").filter(Boolean).join("-");
  return `https://creativecommons.org/licenses/by${parts ? "-" + parts : ""}/${m[2]}/`;
}

export function licenseTerms(license: string | null): string {
  if (!license) return "No license stated in the source data.";
  const terms = ["Credit the contributors."];
  if (/\bNC\b/.test(license)) terms.push("Non-commercial use only.");
  if (/\bSA\b/.test(license)) terms.push("Share adaptations under the same license.");
  if (/\bND\b/.test(license)) terms.push("No derivative works.");
  if (/^cc0|public domain/i.test(license)) return "No restrictions. Credit is still appreciated.";
  return terms.join(" ");
}

export function protocolLabel(d: { minDbh: number | null; minHt: number | null; includesSnags: boolean | null }) {
  const parts = [
    d.minDbh !== null ? `DBH ≥ ${d.minDbh} cm` : null,
    d.minHt !== null ? `height ≥ ${d.minHt} m` : null,
  ].filter(Boolean);
  return (parts.length ? parts.join(" or ") : "Not stated") + (d.includesSnags ? ", incl. snags" : "");
}

const toRad = (x: number) => (x * Math.PI) / 180;
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
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
  files.push({ name: "Attribution and license", format: "TXT", url: datasetFileUrl(d.id, "ATTRIBUTION.txt") });
  if (d.kind === "ground") files.push(
    { name: "Tree measurements", format: "CSV", url: datasetFileUrl(d.id, "trees.csv") },
    { name: "Tree stem locations", format: "GeoJSON", url: datasetFileUrl(d.id, "trees.geojson") },
  );
  return files;
}
