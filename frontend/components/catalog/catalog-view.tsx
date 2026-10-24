"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { Maximize2Icon, Minimize2Icon, SparklesIcon } from "lucide-react";
import { ASSISTANT_NAME } from "@/lib/catalog/assistant";
import { cn } from "@/lib/utils";
import { useCatalog } from "./catalog-provider";
import { CatalogToolbar } from "./catalog-toolbar";
import { ResultsTable } from "./results-table";
import { AssistantDock } from "./assistant-dock";
import { FiltersSheet } from "./filters-sheet";
import { FiltersSidebar } from "./filters-sidebar";
import { QueryResults } from "./query-results";

// Leaflet touches window on import, so the map only loads in the browser.
const CatalogMap = dynamic(() => import("./catalog-map"), { ssr: false });

type Expanded = "map" | "table" | null;

function ExpandButton({ label, on, onClick, className }: { label: string; on: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={on ? `Exit full screen ${label}` : `Full screen ${label}`}
      aria-pressed={on}
      className={cn("flex size-[30px] items-center justify-center rounded-lg border border-input bg-popover text-muted-foreground hover:text-foreground", className)}
    >
      {on ? <Minimize2Icon className="size-3.5" /> : <Maximize2Icon className="size-3.5" />}
    </button>
  );
}

export function CatalogView() {
  const { dockOpen, setDockOpen, catalogLoading, catalogError, reloadCatalog, activeAnswer, results, visible, mapReady, pick, clearAll } = useCatalog();
  const [hiddenAnswer, setHiddenAnswer] = useState<typeof activeAnswer>(null);
  const [expanded, setExpanded] = useState<Expanded>(null);
  const showQuery = activeAnswer !== hiddenAnswer;
  const hidden = results.length - visible.length;
  const tableFull = expanded === "table";

  // The AI panel is part of the page on wide screens; narrow ones open it from the Ask AI button.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setDockOpen(true);
  }, [setDockOpen]);

  // A section expands to a fixed full-window overlay rather than the browser Fullscreen API, which would hide the filter sheet.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const toggle = (section: Exclude<Expanded, null>) => setExpanded((e) => (e === section ? null : section));

  return (
    <div className="relative flex h-[calc(100dvh-var(--nav-h))] min-h-[560px] bg-background">
      <FiltersSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense>
          <CatalogToolbar />
        </Suspense>
        {catalogLoading && <p className="px-5 py-2 text-sm text-muted-foreground">Loading live catalog…</p>}
        {catalogError && <p role="alert" className="px-5 py-2 text-sm text-red-700">{catalogError} <button type="button" onClick={reloadCatalog} className="underline">Retry</button></p>}

        <div
          className={cn(
            "relative isolate min-h-[220px] border-y bg-surface",
            expanded === "map" ? "fixed inset-0 z-[1500] border-0" : "flex-[0_0_42%]",
            tableFull && "hidden",
          )}
        >
          <CatalogMap />
          <ExpandButton label="map" on={expanded === "map"} onClick={() => toggle("map")} className="absolute top-3 left-3 z-[1000] shadow-[0_1px_3px_rgba(0,0,0,0.08)]" />
        </div>

        <div className={cn("flex min-h-0 flex-1 flex-col bg-background", tableFull && "fixed inset-0 z-[1500]", expanded === "map" && "hidden")}>
          <div className="flex shrink-0 items-center gap-3 border-b py-2 pr-5 pl-3 text-[13px] text-muted-foreground">
            <ExpandButton label="table" on={tableFull} onClick={() => toggle("table")} />
            <span className="min-w-0 flex-1 truncate" aria-live="polite" title={pick?.label || undefined}>
              {pick && <SparklesIcon className="mr-1.5 inline size-3.5 align-[-2px] text-primary dark:text-drone-ink" aria-hidden />}
              <span className="font-medium text-foreground tabular-nums">{(tableFull || !mapReady ? results.length : visible.length).toLocaleString()}</span>{" "}
              {(tableFull || !mapReady ? results.length : visible.length) === 1 ? "result" : "results"}
              {pick && <> from {ASSISTANT_NAME}</>}
              {!tableFull && mapReady && hidden > 0 && <span> · {hidden.toLocaleString()} outside the map area</span>}
            </span>
            <button type="button" onClick={clearAll} className="shrink-0 font-medium text-primary hover:underline dark:text-drone-ink">
              Show all
            </button>
          </div>
          {activeAnswer?.data && <div className="flex shrink-0 gap-3 border-b px-5 py-2 text-sm">
            <button type="button" aria-pressed={showQuery} onClick={() => setHiddenAnswer(null)} className={showQuery ? "font-semibold text-primary" : "text-muted-foreground"}>Query data ({activeAnswer.data.row_count})</button>
            <button type="button" aria-pressed={!showQuery} onClick={() => setHiddenAnswer(activeAnswer)} className={!showQuery ? "font-semibold text-primary" : "text-muted-foreground"}>Catalog datasets</button>
          </div>}
          {activeAnswer?.data && showQuery ? <QueryResults data={activeAnswer.data} /> : <ResultsTable showAll={tableFull} />}
        </div>
      </div>
      {dockOpen && <AssistantDock />}
      <FiltersSheet />
    </div>
  );
}
