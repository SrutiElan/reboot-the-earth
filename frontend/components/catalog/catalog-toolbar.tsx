"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClockIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { filterChips, type KindFilter } from "@/lib/catalog/filters";
import { plural } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FOCUS_SEARCH_EVENT } from "@/components/site-navbar";
import { useStoredList } from "@/lib/use-stored-list";
import { useCatalog } from "./catalog-provider";
import { ActiveFilters } from "./active-filters";
import { KindMark } from "./kind-mark";
import { CatalogSwitcher } from "./catalog-switcher";

const KINDS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "drone", label: "Drone" },
  { value: "ground", label: "Ground" },
];

const RECENT_KEY = "ofo.recent-searches.v1";
const MAX_RECENT = 8;

function PlaceSearch() {
  const { catalog, query, setQuery, requestFit } = useCatalog();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { list: recent, add, remove, clear } = useStoredList(RECENT_KEY, MAX_RECENT);
  const input = useRef<HTMLInputElement>(null);
  const params = useSearchParams();

  const remember = (term: string) => {
    const t = term.trim();
    if (t.length >= 2) add(t);
  };
  const forget = (term?: string) => (term ? remove(term) : clear());

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
  // Empty box: show recent searches. Typing: suggest matching places.
  const showRecent = open && !q && recent.length > 0;
  const showPlaces = open && places.length > 0;
  const options = showRecent ? recent : places;

  const choose = (name: string) => {
    setQuery(name);
    remember(name);
    setOpen(false);
    requestFit();
  };

  return (
    <div className="relative min-w-0 flex-[1_1_240px] sm:max-w-[560px]">
      <div className="flex h-[38px] items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30">
        <SearchIcon className="size-[15px] shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          value={query}
          role="combobox"
          aria-expanded={showPlaces || showRecent}
          aria-controls="place-list"
          aria-label="Search places or datasets"
          placeholder="Search places or datasets"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            remember(query);
            setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, options.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter") {
              if (options[active] && (showRecent || showPlaces)) choose(options[active]);
              else {
                remember(query);
                setOpen(false);
              }
            } else if (e.key === "Escape") {
              if (open) setOpen(false);
              else setQuery("");
            }
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            className="rounded-sm text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setQuery("")}
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      {(showPlaces || showRecent) && (
        <ul
          id="place-list"
          role="listbox"
          aria-label={showRecent ? "Recent searches" : "Places"}
          className="absolute top-11 right-0 left-0 z-[1100] rounded-lg border bg-popover p-1 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
        >
          {showRecent && (
            <li role="presentation" className="flex items-center justify-between px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">
              <span>Recent searches</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => forget()} className="hover:text-foreground">
                Clear
              </button>
            </li>
          )}
          {options.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(name);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "group flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm",
                i === active && "bg-muted",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                {showRecent && <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="truncate">{name}</span>
              </span>
              {showRecent ? (
                <button
                  type="button"
                  aria-label={`Remove ${name} from recent searches`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    forget(name);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : (
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {plural(catalog.all.filter((d) => d.site === name).length, "dataset")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CatalogToolbar() {
  const { filters, kind, setKind, setSheet, setDockOpen } = useCatalog();
  const chips = filterChips(filters);
  const params = useSearchParams();
  const kindParam = params.get("kind");
  const aiParam = params.get("ai");
  useEffect(() => {
    if (kindParam === "drone" || kindParam === "ground") setKind(kindParam);
  }, [kindParam, setKind]);
  useEffect(() => {
    if (aiParam) setDockOpen(true);
  }, [aiParam, setDockOpen]);

  return (
    <div className="relative z-[1050] flex flex-col gap-2 bg-background px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <PlaceSearch />

        <div role="radiogroup" aria-label="Dataset type" className="flex h-[38px] rounded-lg border border-input p-[3px] lg:hidden">
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

        <Button variant="outline" className="h-[38px] gap-2 px-3 lg:hidden" onClick={() => setSheet("filters")}>
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

      <div className="lg:hidden">
        <ActiveFilters />
      </div>
    </div>
  );
}
