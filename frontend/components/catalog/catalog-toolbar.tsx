"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClockIcon, MapPinIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import type { Bounds } from "@/lib/catalog";
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

interface Place {
  name: string;
  bounds: Bounds;
}

// OpenStreetMap's public geocoder: fine for a few typed searches, not for bulk use.
async function geocode(q: string, signal: AbortSignal): Promise<Place[]> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const rows = (await res.json()) as { display_name: string; boundingbox: [string, string, string, string] }[];
  return rows.map((r) => ({ name: r.display_name, bounds: { south: +r.boundingbox[0], north: +r.boundingbox[1], west: +r.boundingbox[2], east: +r.boundingbox[3] } }));
}

interface Option {
  key: string;
  label: string;
  hint?: string;
  recent?: boolean;
  place?: boolean;
  choose: () => void;
}

function PlaceSearch() {
  const { catalog, query, setQuery, requestFit, flyTo } = useCatalog();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { list: recent, add, remove, clear } = useStoredList(RECENT_KEY, MAX_RECENT);
  const input = useRef<HTMLInputElement>(null);
  const params = useSearchParams();
  const [found, setFound] = useState<{ q: string; places: Place[] }>({ q: "", places: [] });

  const remember = (term: string) => {
    const t = term.trim();
    if (t.length >= 2) add(t);
  };

  useEffect(() => {
    const focus = () => input.current?.focus();
    if (params.get("search")) focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, [params]);

  const q = query.trim().toLowerCase();

  // Look the text up as a real place once typing pauses.
  useEffect(() => {
    if (q.length < 3) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      geocode(q, abort.signal)
        .then((places) => setFound({ q, places }))
        .catch(() => undefined);
    }, 450);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [q]);

  const sites = q && !catalog.siteNames.some((n) => n.toLowerCase() === q) ? catalog.siteNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 4) : [];
  const places = found.q === q ? found.places : [];

  const chooseText = (name: string) => {
    setQuery(name);
    remember(name);
    setOpen(false);
    requestFit();
  };
  const choosePlace = (place: Place) => {
    // Fly there and clear the text, so the catalog isn't also filtered by the place name.
    setQuery("");
    remember(place.name.split(",")[0]);
    setOpen(false);
    flyTo(place.bounds);
  };

  const showRecent = open && !q && recent.length > 0;
  const options: Option[] = showRecent
    ? recent.map((r) => ({ key: `r-${r}`, label: r, recent: true, choose: () => chooseText(r) }))
    : [
        ...sites.map((s) => ({ key: `s-${s}`, label: s, hint: plural(catalog.all.filter((d) => d.site === s).length, "dataset"), choose: () => chooseText(s) })),
        ...places.map((p) => ({ key: `p-${p.name}`, label: p.name, place: true, choose: () => choosePlace(p) })),
      ];
  const showList = open && options.length > 0;

  return (
    <div className="relative min-w-0 flex-[1_1_240px] sm:max-w-[560px]">
      <div className="flex h-[38px] items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30">
        <SearchIcon className="size-[15px] shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          value={query}
          role="combobox"
          aria-expanded={showList}
          aria-controls="place-list"
          aria-label="Search places or datasets"
          placeholder="Search a place or dataset"
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
              if (showList && options[active]) options[active].choose();
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
      {showList && (
        <ul
          id="place-list"
          role="listbox"
          aria-label={showRecent ? "Recent searches" : "Suggestions"}
          className="absolute top-11 right-0 left-0 z-[1100] max-h-[60vh] overflow-y-auto rounded-lg border bg-popover p-1 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
        >
          {showRecent && (
            <li role="presentation" className="flex items-center justify-between px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">
              <span>Recent searches</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={clear} className="hover:text-foreground">
                Clear
              </button>
            </li>
          )}
          {options.map((o, i) => (
            <li
              key={o.key}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                o.choose();
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm", i === active && "bg-muted")}
            >
              <span className="flex min-w-0 items-center gap-2">
                {o.recent && <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                {o.place && <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="truncate">{o.label}</span>
              </span>
              {o.recent ? (
                <button
                  type="button"
                  aria-label={`Remove ${o.label} from recent searches`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    remove(o.label);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : (
                o.hint && <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{o.hint}</span>
              )}
            </li>
          ))}
          {!showRecent && places.length > 0 && <li role="presentation" className="px-2.5 pt-1 pb-1.5 text-[11px] text-muted-foreground">Places from OpenStreetMap</li>}
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
        <ActiveFilters clearable />
      </div>
    </div>
  );
}
