import type { Dataset, DroneMission, GroundPlot } from "./types";
export type * from "./types";

export interface Catalog {
  missions: DroneMission[];
  plots: GroundPlot[];
  all: Dataset[];
  siteNames: string[];
  years: number[];
  aircraft: string[];
  licenses: string[];
  byId: (id: string) => Dataset | undefined;
}

export function buildCatalog(all: Dataset[]): Catalog {
  const missions = all.filter((d): d is DroneMission => d.kind === "drone");
  const plots = all.filter((d): d is GroundPlot => d.kind === "ground");
  const index = new Map(all.map((d) => [d.id, d]));
  return {
    all, missions, plots,
    siteNames: [...new Set(all.map((d) => d.site))].sort(),
    years: [...new Set(all.map((d) => d.year).filter((y): y is number => y !== null))].sort((a, b) => a - b),
    aircraft: [...new Set(missions.map((d) => d.aircraft).filter((a): a is string => !!a))].sort(),
    licenses: [...new Set(all.map((d) => d.license).filter((l): l is string => !!l))].sort(),
    byId: (id) => index.get(id),
  };
}
