import { AIRCRAFT, RAW_MISSIONS, SITES } from "./sample-data";
import type { Dataset, DroneMission, GroundPlot } from "./types";

export type * from "./types";

// Placeholder catalog built in memory from the prototype data. When the FastAPI
// service is ready, replace buildCatalog() with fetches to its endpoints and keep
// the Catalog shape so the UI doesn't change.

export interface Catalog {
  missions: DroneMission[];
  plots: GroundPlot[];
  all: Dataset[];
  siteNames: string[];
  years: number[];
  aircraft: string[];
  byId: (id: string) => Dataset | undefined;
}

// Deterministic 0..1 hash so generated positions match on server and client.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const SPECIES = [
  "PIPO, ABCO",
  "ABCO, PILA",
  "PSME, CADE",
  "ABMA, PICO",
  "PIJE, ABCO",
  "QUKE, PIPO",
  "QUDO, QUAG",
  "PSME, TSHE",
];

function buildCatalog(): Catalog {
  const missions: DroneMission[] = RAW_MISSIONS.trim()
    .split("\n")
    .map((line) => {
      const [id, area, date, alt, pitch, images, name, ac, withheld] = line.split("|");
      const low = name.toLowerCase();
      const site = SITES.find((s) => s[0].test(low))!;
      const base = low.replace(
        /[-_ ](50|60|65|70|80|90|100|105|110|120|130|140|150)(m|ft|nadir|oblique)?([-_ ].*|v\d)?$/,
        "",
      );
      const lat = site[2] + (hash(base + "a") - 0.5) * 2 * site[4];
      const lng = site[3] + (hash(base + "b") - 0.5) * 2 * site[4] * 1.3;
      const km = Math.sqrt(+area) / 10;
      return {
        kind: "drone",
        id,
        name,
        site: site[1],
        date,
        year: +date.slice(0, 4),
        areaHa: +area,
        altitudeM: alt ? +alt : null,
        cameraPitch: +pitch,
        imageCount: +images,
        aircraft: AIRCRAFT[ac],
        withheld: withheld === "1",
        oblique: +pitch >= 5,
        lat,
        lng,
        dLat: km / 111 / 2,
        dLng: km / (111 * Math.cos((lat * Math.PI) / 180)) / 2,
        overlaps: [],
      };
    });

  // Ground plots are synthetic: generated inside drone footprints so overlaps exist.
  const plots: GroundPlot[] = [];
  const seen = new Set<string>();
  let n = 1;
  for (const m of missions) {
    const key = m.site + Math.round(m.lat * 100) + Math.round(m.lng * 100);
    if (seen.has(key) || m.areaHa > 250) continue;
    seen.add(key);
    if (hash(m.id + "p") > 0.62) continue;
    const count = hash(m.id + "k") > 0.6 ? 2 : 1;
    for (let j = 0; j < count; j++) {
      const year = Math.max(2019, m.year - (hash(m.id + "yr" + j) > 0.6 ? 1 : 0));
      const month = 6 + Math.floor(hash(m.id + "mo" + j) * 4);
      const day = 1 + Math.floor(hash(m.id + "d" + j) * 28);
      const num = String(n).padStart(4, "0");
      plots.push({
        kind: "ground",
        id: "plot_" + num,
        name: "Plot " + num,
        site: m.site,
        lat: m.lat + (hash(m.id + "x" + j) - 0.5) * m.dLat * 1.2,
        lng: m.lng + (hash(m.id + "y" + j) - 0.5) * m.dLng * 1.2,
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        year,
        trees: 30 + Math.floor(hash(m.id + "t" + j) * 320),
        plotHa: [0.04, 0.1, 0.25, 0.5, 1][Math.floor(hash(m.id + "s" + j) * 5)],
        species: SPECIES[Math.floor(hash(m.site) * SPECIES.length)],
        overlaps: [],
      });
      n++;
    }
  }

  for (const m of missions) {
    for (const p of plots) {
      if (Math.abs(p.lat - m.lat) <= m.dLat && Math.abs(p.lng - m.lng) <= m.dLng) {
        m.overlaps.push(p.id);
        p.overlaps.push(m.id);
      }
    }
  }

  const newestFirst = (a: Dataset, b: Dataset) => b.date.localeCompare(a.date);
  missions.sort(newestFirst);
  plots.sort(newestFirst);
  const all: Dataset[] = [...missions, ...plots];
  const index = new Map(all.map((d) => [d.id, d]));

  return {
    missions,
    plots,
    all,
    siteNames: [...new Set(all.map((d) => d.site))].sort(),
    years: [...new Set(all.map((d) => d.year))].sort((a, b) => a - b),
    aircraft: [...new Set(missions.map((d) => d.aircraft))].sort(),
    byId: (id) => index.get(id),
  };
}

export const catalog = buildCatalog();

export function stacUrl(d: Dataset) {
  const collection = d.kind === "drone" ? "drone-missions" : "ground-plots";
  return `https://stac.cyverse.org/ofo/${collection}/items/${d.id}.json`;
}
