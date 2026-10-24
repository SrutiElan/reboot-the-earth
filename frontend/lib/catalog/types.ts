// Actual records returned by the FastAPI catalog endpoint.

import type { Geometry } from "geojson";
export type DatasetKind = "drone" | "ground";

interface DatasetBase {
  id: string;
  sourceId: string;
  sourceLabel: string;
  submissionId: string | null;
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
  /** Training/testing split flag from the source data (about 20% of records are withheld). */
  withheld: boolean;
  /** Creative Commons (or public domain) license of this record. */
  license: string | null;
  /** Contributors to credit when sharing. */
  contributors: string | null;
}

export interface DroneMission extends DatasetBase {
  kind: "drone";
  areaHa: number | null;
  altitudeM: number | null;
  cameraPitch: number | null;
  imageCount: number | null;
  aircraft: string | null;
  oblique: boolean;
}

export interface GroundPlot extends DatasetBase {
  kind: "ground";
  trees: number;
  plotHa: number | null;
  species: string | null;
  /** Tally rules: trees below these thresholds were not measured. */
  minDbh: number | null;
  minHt: number | null;
  includesSnags: boolean | null;
  hyperplot: string | null;
}

export type Dataset = DroneMission | GroundPlot;

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}
