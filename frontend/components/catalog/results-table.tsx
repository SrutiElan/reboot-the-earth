"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { Dataset } from "@/lib/catalog";
import { areaLabel, cameraLabel, overlapLabel } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useCatalog } from "./catalog-provider";
import { KindBadge, WithheldBadge } from "./kind-mark";

type SortKey = "name" | "kind" | "date" | "area" | "alt" | "overlaps";

const num = (d: Dataset, key: SortKey): number | string => {
  switch (key) {
    case "name":
      return d.name.toLowerCase();
    case "kind":
      return d.kind;
    case "date":
      return d.date;
    case "area":
      return d.kind === "drone" ? d.areaHa : d.plotHa;
    case "alt":
      return d.kind === "drone" ? (d.altitudeM ?? -1) : -1;
    case "overlaps":
      return d.overlaps.length;
  }
};

const COLUMNS: { key?: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Name" },
  { key: "kind", label: "Type" },
  { key: "date", label: "Date" },
  { key: "area", label: "Area", align: "right" },
  { key: "alt", label: "Altitude", align: "right" },
  { label: "Camera" },
  { label: "Aircraft" },
  { key: "overlaps", label: "Overlaps" },
];

export function ResultsTable() {
  const { visible, mapReady, results, hoverId, setHoverId, collection, toggleCollection, clearAll } = useCatalog();
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });

  const rows = useMemo(() => {
    if (!mapReady) return [];
    const out = [...visible];
    out.sort((a, b) => {
      const x = num(a, sort.key);
      const y = num(b, sort.key);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || b.date.localeCompare(a.date);
    });
    return out;
  }, [visible, sort, mapReady]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" || key === "kind" ? 1 : -1 }));

  const hidden = results.length - visible.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline gap-3 border-b px-5 py-2.5 text-[13px] text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">{visible.length.toLocaleString()}</span>{" "}
          {visible.length === 1 ? "dataset" : "datasets"} in map area
        </span>
        {hidden > 0 && <span>{hidden.toLocaleString()} more outside it</span>}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[920px] border-collapse text-[13px] tabular-nums">
          <thead className="sticky top-0 z-[1] bg-background text-left text-muted-foreground">
            <tr>
              <th className="w-11 border-b py-2 pl-5">
                <span className="sr-only">In collection</span>
              </th>
              {COLUMNS.map((c, i) => {
                const active = c.key && sort.key === c.key;
                return (
                  <th
                    key={c.label}
                    scope="col"
                    aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                    className={cn(
                      "border-b px-3 py-2 font-medium whitespace-nowrap",
                      c.align === "right" && "text-right",
                      i === COLUMNS.length - 1 && "pr-5",
                    )}
                  >
                    {c.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key!)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
                          active && "text-foreground",
                        )}
                      >
                        {c.label}
                        {active &&
                          (sort.dir === 1 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const inCol = collection.includes(d.id);
              const href = `/data/datasets/${d.id}`;
              const cell = "border-b border-border/60 px-3 py-2.5 text-muted-foreground whitespace-nowrap";
              return (
                <tr
                  key={d.id}
                  onClick={() => router.push(href)}
                  onMouseEnter={() => setHoverId(d.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className={cn(
                    "cursor-pointer",
                    hoverId === d.id ? "bg-muted/60" : inCol ? "bg-selected" : "hover:bg-muted/60",
                  )}
                >
                  <td className="border-b border-border/60 py-2.5 pl-5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={inCol}
                      onCheckedChange={() => toggleCollection(d.id)}
                      aria-label={`${inCol ? "Remove" : "Add"} ${d.name} ${inCol ? "from" : "to"} collection`}
                      className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                    />
                  </td>
                  <td className="max-w-[300px] border-b border-border/60 px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(href);
                        }}
                        className="truncate font-medium text-foreground outline-none hover:underline focus-visible:underline"
                      >
                        {d.name}
                      </a>
                      {d.kind === "drone" && d.withheld && <WithheldBadge />}
                    </div>
                    <div className="mt-0.5 flex gap-2.5 text-xs text-muted-foreground">
                      <span>{d.id}</span>
                      <span className="truncate">{d.site}</span>
                    </div>
                  </td>
                  <td className={cell}>
                    <KindBadge kind={d.kind} />
                  </td>
                  <td className={cell}>{d.date}</td>
                  <td className={cn(cell, "text-right")}>{areaLabel(d)}</td>
                  <td className={cn(cell, "text-right")}>
                    {d.kind === "drone" && d.altitudeM ? `${d.altitudeM} m` : "—"}
                  </td>
                  <td className={cell}>{cameraLabel(d)}</td>
                  <td className={cell}>{d.kind === "drone" ? d.aircraft : "—"}</td>
                  <td className={cn(cell, "pr-5")}>{overlapLabel(d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {mapReady && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center text-sm text-muted-foreground">
            <p>{results.length ? "Nothing in this map area. Zoom out to see the other matches." : "No datasets match these filters."}</p>
            {!results.length && (
              <button type="button" onClick={clearAll} className="font-medium text-primary underline underline-offset-[3px]">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
