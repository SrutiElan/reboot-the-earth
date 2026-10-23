"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { filterChips, type KindFilter } from "@/lib/catalog/filters";
import { plural } from "@/lib/catalog/format";
import { ASSISTANT_NAME } from "@/lib/catalog/assistant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FOCUS_SEARCH_EVENT } from "@/components/site-navbar";
import { useCatalog } from "./catalog-provider";
import { KindMark } from "./kind-mark";
import { CatalogSwitcher } from "./catalog-switcher";

const KINDS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "drone", label: "Drone" },
  { value: "ground", label: "Ground" },
];

function PlaceSearch() {
  const { catalog, query, setQuery, requestFit } = useCatalog();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const params = useSearchParams();

  useEffect(() => {
    const focus = () => input.current?.focus();
    if (params.get("search")) focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, [params]);

  const q = query.trim().toLowerCase();
  const places =
    q && !catalog.siteNames.some((n) => n.toLowerCase() === q)
      ? catalog.siteNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 6)
      : [];
  const showPlaces = open && places.length > 0;

  const goPlace = (name: string) => {
    setQuery(name);
    setOpen(false);
    requestFit();
  };

  return (
    <div className="relative min-w-0 flex-[1_1_240px] sm:max-w-[380px]">
      <div className="flex h-[38px] items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30">
        <SearchIcon className="size-[15px] shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          value={query}
          role="combobox"
          aria-expanded={showPlaces}
          aria-controls="place-list"
          aria-label="Search places or datasets"
          placeholder="Search places or datasets"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, places.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter" && places[active]) goPlace(places[active]);
            else if (e.key === "Escape") setQuery("");
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            className="rounded-sm text-muted-foreground hover:text-foreground"
            onClick={() => setQuery("")}
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      {showPlaces && (
        <ul
          id="place-list"
          role="listbox"
          className="absolute top-11 right-0 left-0 z-[1100] rounded-lg border bg-popover p-1 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
        >
          {places.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                goPlace(name);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer justify-between gap-2 rounded-md px-2.5 py-2 text-sm",
                i === active && "bg-muted",
              )}
            >
              <span>{name}</span>
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {plural(catalog.all.filter((d) => d.site === name).length, "dataset")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex h-[30px] items-center gap-0.5 rounded-full bg-muted pr-1 pl-3 text-[13px] font-medium whitespace-nowrap">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="flex rounded-full p-1 text-muted-foreground hover:text-foreground"
      >
        <XIcon className="size-3" strokeWidth={2.5} />
      </button>
    </span>
  );
}

export function CatalogToolbar() {
  const { filters, patchFilters, pick, clearPick, kind, setKind, setSheet, clearAll } = useCatalog();
  const chips = filterChips(filters);
  const params = useSearchParams();
  const kindParam = params.get("kind");
  useEffect(() => {
    if (kindParam === "drone" || kindParam === "ground") setKind(kindParam);
  }, [kindParam, setKind]);
  const anything = chips.length > 0 || pick;

  return (
    <div className="relative z-[1050] flex flex-col gap-2 bg-background px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <PlaceSearch />

        <div role="radiogroup" aria-label="Dataset type" className="flex h-[38px] rounded-lg border border-input p-[3px]">
          {KINDS.map((k) => (
            <button
              key={k.value}
              role="radio"
              aria-checked={kind === k.value}
              onClick={() => setKind(k.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium",
                kind === k.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k.value !== "all" && <KindMark kind={k.value} className="size-[7px]" />}
              {k.label}
            </button>
          ))}
        </div>

        <Button variant="outline" className="h-[38px] gap-2 px-3" onClick={() => setSheet("filters")}>
          <SlidersHorizontalIcon className="size-[15px]" />
          Filters
          {chips.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-white tabular-nums">
              {chips.length}
            </span>
          )}
        </Button>

        <div className="ml-auto">
          <CatalogSwitcher />
        </div>
      </div>

      {anything && (
        <div className="flex flex-wrap items-center gap-2">
          {pick && (
            <Chip
              label={pick.label ? `${pick.label}, from ${ASSISTANT_NAME}` : `Picked by ${ASSISTANT_NAME}`}
              onRemove={clearPick}
            />
          )}
          {chips.map((c) => (
            <Chip key={c.id} label={c.label} onRemove={() => patchFilters(c.clear)} />
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="h-[30px] rounded-md px-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
