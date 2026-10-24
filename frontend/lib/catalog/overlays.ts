// Colour scales, legends and tile URLs for the detail-page map overlays.

/** Public Titiler reads the cloud-optimized GeoTIFFs in place and serves map tiles. Override to self-host. */
export const TILER = process.env.NEXT_PUBLIC_TILER_URL ?? "https://titiler.xyz";

export type RasterKey = "ortho" | "chm" | "dsm";

export interface RasterSpec {
  key: RasterKey;
  label: string;
  what: string;
  unit: string | null;
  colormap: "viridis" | "magma" | null;
}

export const RASTERS: RasterSpec[] = [
  { key: "ortho", label: "Orthomosaic", what: "Stitched drone photo", unit: null, colormap: null },
  { key: "chm", label: "Canopy height", what: "Height of the canopy above ground", unit: "m", colormap: "viridis" },
  { key: "dsm", label: "Surface elevation", what: "Elevation of the top surface", unit: "m", colormap: "magma" },
];

export const VIRIDIS = ["#440154", "#414487", "#2A788E", "#22A884", "#7AD151", "#FDE725"];
export const MAGMA = ["#000004", "#3B0F70", "#8C2981", "#DE4968", "#FE9F6D", "#FCFDBF"];

export const gradient = (stops: string[]) => `linear-gradient(to right, ${stops.join(", ")})`;

export function rasterTemplate(url: string, spec: RasterSpec, range: [number, number] | null) {
  const params = [`url=${encodeURIComponent(url)}`];
  if (spec.colormap && range) params.push("bidx=1", `rescale=${range[0]},${range[1]}`, `colormap_name=${spec.colormap}`);
  // Leaflet fills {z}/{x}/{y}, so they must stay unescaped.
  return `${TILER}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?${params.join("&")}`;
}

/** Display range from the raster's own 2nd to 98th percentile so outliers don't wash out the colours. */
export async function rasterRange(url: string, signal: AbortSignal): Promise<[number, number]> {
  const res = await fetch(`${TILER}/cog/statistics?url=${encodeURIComponent(url)}&bidx=1`, { signal });
  if (!res.ok) throw new Error(`Raster statistics failed (${res.status})`);
  const stats = Object.values((await res.json()) as Record<string, { percentile_2: number; percentile_98: number }>)[0];
  const lo = Math.max(0, Math.floor(stats.percentile_2));
  return [lo, Math.max(lo + 1, Math.ceil(stats.percentile_98))];
}

export type TreeColorBy = "species" | "height" | "dbh" | "status";

export const TREE_COLOR_OPTIONS: { value: TreeColorBy; label: string }[] = [
  { value: "species", label: "Species" },
  { value: "height", label: "Height" },
  { value: "dbh", label: "Trunk diameter" },
  { value: "status", label: "Live or dead" },
];

export interface TreeProps {
  species_code?: string | null;
  height?: number | null;
  dbh?: number | null;
  live_dead?: string | null;
}

const SPECIES_COLORS = ["#4E79A7", "#F28E2B", "#59A14F", "#E15759", "#B07AA1", "#76B7B2", "#EDC948"];
const OTHER = "#9AA0A6";

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export function rampColor(stops: string[], t: number) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const a = hex(stops[i]);
  const b = hex(stops[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * (x - i))).join(",")})`;
}

export interface TreeStyle {
  color: (p: TreeProps) => string;
  radius: (p: TreeProps) => number;
  legend: { kind: "classes"; items: { label: string; color: string }[] } | { kind: "ramp"; stops: string[]; min: number; max: number; unit: string };
}

export function treeStyle(trees: TreeProps[], by: TreeColorBy): TreeStyle {
  const radius = (p: TreeProps) => Math.min(10, Math.max(3, 3 + (p.dbh ?? 0) / 8));
  if (by === "status") {
    const col = (p: TreeProps) => (p.live_dead === "D" ? "#7B5E3B" : p.live_dead === "M" ? OTHER : "#2E9E5B");
    return { color: col, radius, legend: { kind: "classes", items: [{ label: "Live", color: "#2E9E5B" }, { label: "Dead", color: "#7B5E3B" }, { label: "Unknown", color: OTHER }] } };
  }
  if (by === "species") {
    const counts = new Map<string, number>();
    for (const t of trees) if (t.species_code) counts.set(t.species_code, (counts.get(t.species_code) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, SPECIES_COLORS.length).map(([s]) => s);
    const col = (p: TreeProps) => { const i = top.indexOf(p.species_code ?? ""); return i >= 0 ? SPECIES_COLORS[i] : OTHER; };
    const items = top.map((s, i) => ({ label: s, color: SPECIES_COLORS[i] }));
    if (counts.size > top.length) items.push({ label: "Other", color: OTHER });
    return { color: col, radius, legend: { kind: "classes", items } };
  }
  const get = (p: TreeProps) => (by === "height" ? p.height : p.dbh);
  const vals = trees.map(get).filter((v): v is number => typeof v === "number" && v > 0 && v < (by === "height" ? 100 : 500)).sort((a, b) => a - b);
  const min = vals.length ? Math.floor(vals[Math.floor(vals.length * 0.02)]) : 0;
  const max = vals.length ? Math.ceil(vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.98))]) : 1;
  const col = (p: TreeProps) => { const v = get(p); return typeof v === "number" ? rampColor(VIRIDIS, (v - min) / Math.max(1, max - min)) : OTHER; };
  return { color: col, radius, legend: { kind: "ramp", stops: VIRIDIS, min, max, unit: by === "height" ? "m" : "cm" } };
}
