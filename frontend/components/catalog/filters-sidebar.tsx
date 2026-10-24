"use client";

import { filterChips } from "@/lib/catalog/filters";
import { useCatalog } from "./catalog-provider";
import { ActiveFilters } from "./active-filters";
import { FilterControls } from "./filters-sheet";
import { KindPicker } from "./kind-picker";

// Always-visible filters on wide screens; narrow screens use the Filters button and sheet.
// The header and the active filters stay pinned while the controls scroll.
export function FiltersSidebar() {
  const { filters, clearFilters } = useCatalog();
  const active = filterChips(filters).length;

  return (
    <aside aria-label="Filters" className="hidden w-[280px] shrink-0 flex-col border-r bg-background lg:flex">
      <div className="shrink-0 border-b">
        <div className="flex items-baseline gap-2 px-5 py-3">
          <h2 className="flex-1 text-lg font-semibold tracking-[-0.01em]">Filters</h2>
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
        <KindPicker />
        <FilterControls />
      </div>
    </aside>
  );
}
