// Actual records returned by the FastAPI catalog endpoint.

import type { Geometry } from "geojson";
export type DatasetKind = "drone" | "ground";

interface DatasetBase {
  id: string;
  sourceId: string;
  name: string;
  site: string;
  /** Source date precision is preserved: YYYY, YYYY-MM, or YYYY-MM-DD. */
  date: string;
  year: number | null;
  /** Actual centroid/location and source footprint. */
  lat: number | null;
  lng: number | null;
  geometry: Geometry | null;
  dateApproximate: boolean;
  /** Real footprint intersections computed by PostGIS. */
  overlaps: string[];
}

export interface DroneMission extends DatasetBase {
  kind: "drone";
  areaHa: number | null;
  altitudeM: number | null;
  cameraPitch: number | null;
  imageCount: number | null;
  aircraft: string | null;
  withheld: boolean;
  oblique: boolean;
}

export interface GroundPlot extends DatasetBase {
  kind: "ground";
  trees: number;
  plotHa: number | null;
  species: string | null;
}

export type Dataset = DroneMission | GroundPlot;

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}
