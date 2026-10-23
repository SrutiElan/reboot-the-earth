// Shapes mirror what the FastAPI backend will return (see design handoff README,
// "Data needed from the backend").

export type DatasetKind = "drone" | "ground";

interface DatasetBase {
  id: string;
  name: string;
  site: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  year: number;
  /** Center point. Drone footprints are approximated as boxes around it. */
  lat: number;
  lng: number;
  /** Ids from the precomputed dataset_overlaps table */
  overlaps: string[];
}

export interface DroneMission extends DatasetBase {
  kind: "drone";
  areaHa: number;
  altitudeM: number | null;
  cameraPitch: number;
  imageCount: number;
  aircraft: string;
  withheld: boolean;
  oblique: boolean;
  /** Half-height and half-width of the footprint box, in degrees */
  dLat: number;
  dLng: number;
}

export interface GroundPlot extends DatasetBase {
  kind: "ground";
  trees: number;
  plotHa: number;
  species: string;
}

export type Dataset = DroneMission | GroundPlot;

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}
