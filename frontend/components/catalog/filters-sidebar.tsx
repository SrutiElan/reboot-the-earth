"use client";

import { filterChips, type KindFilter } from "@/lib/catalog/filters";
import { cn } from "@/lib/utils";
import { useCatalog } from "./catalog-provider";
import { ActiveFilters } from "./active-filters";
import { FilterControls } from "./filters-sheet";
import { KindMark } from "./kind-mark";

const KINDS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All datasets" },
  { value: "drone", label: "Drone missions" },
  { value: "ground", label: "Ground plots" },
];

// Always-visible filters on wide screens; narrow screens use the Filters button and sheet.
// The header and the active filters stay pinned while the controls scroll.
export function FiltersSidebar() {
  const { filters, kind, setKind, clearFilters } = useCatalog();
  const active = filterChips(filters).length;

  return (
    <aside aria-label="Filters" className="hidden w-[280px] shrink-0 flex-col border-r bg-background lg:flex">
      <div className="shrink-0 border-b">
        <div className="flex items-baseline gap-2 px-5 py-3">
          <h2 className="flex-1 text-[15px] font-semibold">Filters</h2>
          {active > 0 && (
            <button type="button" onClick={clearFilters} className="text-[13px] font-medium text-primary hover:underline dark:text-drone-ink">
              Clear all
            </button>
          )}
        </div>
        {active > 0 && (
          <div className="max-h-[132px] overflow-y-auto px-5 pb-3">
            <ActiveFilters />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        <div role="radiogroup" aria-label="Dataset type" className="flex flex-col gap-1">
          <span className="mb-1 text-sm font-semibold">Dataset type</span>
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              onClick={() => setKind(k.value)}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm",
                kind === k.value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k.value === "all" ? <span className="size-2" aria-hidden /> : <KindMark kind={k.value} />}
              {k.label}
            </button>
          ))}
        </div>
        <FilterControls />
      </div>
    </aside>
  );
}
