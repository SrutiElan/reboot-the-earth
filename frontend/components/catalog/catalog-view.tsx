"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useCatalog } from "./catalog-provider";
import { CatalogToolbar } from "./catalog-toolbar";
import { ResultsTable } from "./results-table";
import { AssistantDock } from "./assistant-dock";
import { FiltersSheet } from "./filters-sheet";

// Leaflet touches window on import, so the map only loads in the browser.
const CatalogMap = dynamic(() => import("./catalog-map"), { ssr: false });

function MapLegend() {
  return (
    <div className="absolute top-3 left-3 z-[1000] flex flex-wrap gap-x-3 gap-y-1 rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <span className="flex items-center gap-1.5">
        <span className="h-[9px] w-3 rounded-[2px] border-[1.5px] border-drone bg-drone-tint" />
        Drone mission
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-[9px] rounded-full bg-ground" />
        Ground plot
      </span>
    </div>
  );
}

export function CatalogView() {
  const { dockOpen } = useCatalog();

  return (
    <div className="relative flex h-[calc(100dvh-var(--nav-h))] min-h-[560px]">
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense>
          <CatalogToolbar />
        </Suspense>
        <div className="relative isolate min-h-[220px] flex-[0_0_42%] border-y bg-surface">
          <CatalogMap />
          <MapLegend />
        </div>
        <ResultsTable />
      </div>
      {dockOpen && <AssistantDock />}
      <FiltersSheet />
    </div>
  );
}
