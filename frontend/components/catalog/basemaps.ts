// Kept apart from map-style.ts so server-rendered code can use it without loading Leaflet.
// Esri basemaps need no API key; the Esri attribution is required.
export type Basemap = "topo" | "satellite";

export const BASEMAPS: Record<Basemap, { label: string; url: string; maxZoom: number }> = {
  topo: {
    label: "Terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 17,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 17,
  },
};

export const BASEMAP_ATTRIBUTION = "Tiles © Esri, USGS, NOAA";
