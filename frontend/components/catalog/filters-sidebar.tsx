"use client";

import { useSyncExternalStore } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { filterChips } from "@/lib/catalog/filters";
import { useCatalog } from "./catalog-provider";
import { ActiveFilters } from "./active-filters";
import { FilterControls } from "./filters-sheet";
import { KindPicker } from "./kind-picker";

const COLLAPSED_KEY = "ofo-filters-collapsed";
const EVENT = "filters-collapsed-change";

/** Whether the sidebar is collapsed, remembered in localStorage and safe when storage is blocked. */
function useCollapsed() {
  const collapsed = useSyncExternalStore(
    (notify) => {
      window.addEventListener(EVENT, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(EVENT, notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => {
      try {
        return localStorage.getItem(COLLAPSED_KEY) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const setCollapsed = (next: boolean) => {
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return [collapsed, setCollapsed] as const;
}

const toggleButton =
  "flex size-[30px] shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none";

// Always-visible filters on wide screens; narrow screens use the Filters button and sheet.
// The header and the active filters stay pinned while the controls scroll. Collapsing leaves a
// slim rail with the expand button and the active filter count, giving the map and table the room.
export function FiltersSidebar() {
  const { filters, clearFilters } = useCatalog();
  const [collapsed, setCollapsed] = useCollapsed();
  const active = filterChips(filters).length;

  if (collapsed) {
    return (
      <aside aria-label="Filters" className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r bg-background py-3 lg:flex">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-label={active ? `Show filters, ${active} active` : "Show filters"}
          title="Show filters"
          className={toggleButton}
        >
          <PanelLeftOpenIcon className="size-4" />
        </button>
        {active > 0 && (
          <span
            aria-hidden
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-white tabular-nums"
          >
            {active}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside id="filters-panel" aria-label="Filters" className="hidden w-[280px] shrink-0 flex-col border-r bg-background lg:flex">
      <div className="shrink-0 border-b">
        <div className="flex items-center gap-2 py-3 pr-3 pl-5">
          <h2 className="flex-1 text-lg font-semibold tracking-[-0.01em]">Filters</h2>
          {active > 0 && (
            <button type="button" onClick={clearFilters} className="text-[13px] font-medium text-primary hover:underline dark:text-drone-ink">
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-expanded
            aria-controls="filters-panel"
            aria-label="Hide filters"
            title="Hide filters"
            className={toggleButton}
          >
            <PanelLeftCloseIcon className="size-4" />
          </button>
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
