"use client";

import { FILTER_SECTIONS, filterChips, type FilterSection } from "@/lib/catalog/filters";
import { plural } from "@/lib/catalog/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCatalog } from "./catalog-provider";

// Select items can't hold an empty value, so "any" stands in for "no filter".
const ANY = "any";

function SectionLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold">
      {children}
    </label>
  );
}

function Section({ section }: { section: FilterSection }) {
  const { catalog, filters, patchFilters } = useCatalog();

  switch (section.type) {
    case "year-range": {
      const backwards = !!filters.yFrom && !!filters.yTo && +filters.yFrom > +filters.yTo;
      return (
        <div className="flex flex-col gap-2">
          <SectionLabel>{section.label}</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(["yFrom", "yTo"] as const).map((key) => (
              <input
                key={key}
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                value={filters[key]}
                placeholder={key === "yFrom" ? "From year" : "To year"}
                aria-label={key === "yFrom" ? "From year" : "To year"}
                aria-invalid={backwards || undefined}
                onChange={(e) => patchFilters({ [key]: e.target.value.slice(0, 4) })}
                className="h-[38px] w-full rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-red-600 dark:bg-input/30"
              />
            ))}
          </div>
          <p className={backwards ? "text-xs text-red-700 dark:text-red-300" : "text-xs text-muted-foreground"}>
            {backwards ? "The first year is after the last year." : "Type any year; leave a box empty for no limit."}
          </p>
        </div>
      );
    }
    case "segmented":
      return (
        <div className="flex flex-col gap-2">
          <SectionLabel>{section.label}</SectionLabel>
          <ToggleGroup
            type="single"
            spacing={0}
            value={filters[section.key] || ANY}
            onValueChange={(v) => v && patchFilters({ [section.key]: v === ANY ? "" : v })}
            className="grid w-full rounded-lg bg-muted p-[3px]"
            style={{ gridTemplateColumns: `repeat(${section.options.length}, 1fr)` }}
            aria-label={section.label}
          >
            {section.options.map((o) => (
              <ToggleGroupItem
                key={o.value || ANY}
                value={o.value || ANY}
                className="h-[30px] rounded-md! px-1 text-[13px] text-muted-foreground hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,0.1)] dark:data-[state=on]:bg-card"
              >
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      );
    case "select":
      return (
        <div className="flex flex-col gap-2">
          <SectionLabel>{section.label}</SectionLabel>
          <Select
            value={filters[section.key] || ANY}
            onValueChange={(v) => patchFilters({ [section.key]: v === ANY ? "" : v })}
          >
            <SelectTrigger className="h-[38px] w-full" aria-label={section.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{section.anyLabel}</SelectItem>
              {(section.key === "license" ? catalog.licenses : catalog.aircraft).map((a) => ({ value: a, label: a })).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "divider":
      return <Separator />;
    case "switch": {
      const id = `filter-${section.key}`;
      return (
        <div className="flex items-start gap-3">
          <label htmlFor={id} className="flex-1 cursor-pointer">
            <span className="block text-sm font-medium">{section.label}</span>
            <span className="mt-0.5 block text-[13px] leading-normal text-muted-foreground">{section.description}</span>
          </label>
          <Switch
            id={id}
            className="mt-0.5"
            checked={filters[section.key]}
            onCheckedChange={(on) => patchFilters({ [section.key]: on })}
          />
        </div>
      );
    }
  }
}

/** The filter controls, shared by the sidebar and the mobile sheet. */
export function FilterControls() {
  return (
    <>
      {FILTER_SECTIONS.map((s, i) => (
        <Section key={i} section={s} />
      ))}
      <p className="text-[13px] leading-normal text-muted-foreground">
        Camera, altitude, area and aircraft describe drone missions; smallest tree and snags describe ground plots.
        A record stays in the results when something that overlaps it matches.
      </p>
    </>
  );
}

export function FiltersSheet() {
  const { sheet, setSheet, filters, clearFilters, results } = useCatalog();
  const active = filterChips(filters).length;

  return (
    <Sheet open={sheet === "filters"} onOpenChange={(o) => setSheet(o ? "filters" : null)}>
      <SheetContent className="w-full gap-0 sm:max-w-[420px]">
        <SheetHeader className="border-b px-6 pt-5 pb-4">
          <SheetTitle className="text-lg font-semibold">Filters</SheetTitle>
          <SheetDescription>{active ? `${active} active` : "No active filters"}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <FilterControls />
        </div>
        <SheetFooter className="grid grid-cols-[1fr_1.4fr] gap-2 border-t px-6 py-4">
          <Button variant="outline" className="h-10" onClick={clearFilters}>
            Clear all
          </Button>
          <Button className="h-10 hover:bg-primary-hover" onClick={() => setSheet(null)}>
            Show {plural(results.length, "result")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
