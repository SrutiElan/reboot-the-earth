"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import type { Dataset, DatasetKind } from "@/lib/catalog";
import { areaLabel, formatDate, plural } from "@/lib/catalog/format";
import { trustFor } from "@/lib/catalog/trust";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";
import { BarList, ChartCard, ChartMark, DotTimeline, type ChartItem } from "./charts";
import { CatalogSwitcher } from "./catalog-switcher";

const MAX_CHARTED = 40;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold [overflow-wrap:anywhere]">{value}</dd>
      {sub && <dd className="mt-0.5 text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

const area = (d: Dataset) => (d.kind === "drone" ? d.areaHa : d.plotHa);

// Several records side by side: when they were collected, how big they are, how they were measured, and under what license.
export function CompareView() {
  const { catalog, catalogLoading, catalogError, reloadCatalog, collection, toggleCollection, setInCollection } = useCatalog();
  const items = collection.map((id) => catalog.byId(id)).filter((d): d is Dataset => !!d);
  const charted = items.slice(0, MAX_CHARTED);

  const item = (d: Dataset, value: number, detail?: string): ChartItem => ({ id: d.id, label: d.name, kind: d.kind, value, detail });
  const kindsOf = (list: Dataset[]): DatasetKind[] => (["drone", "ground"] as const).filter((k) => list.some((d) => d.kind === k));

  const areas = charted.flatMap((d) => (area(d) ? [item(d, area(d)!, `${formatDate(d.date)} · ${d.site}`)] : [])).sort((a, b) => b.value - a.value);
  const trees = charted.flatMap((d) => (d.kind === "ground" ? [item(d, d.trees, `${formatDate(d.date)} · ${d.site}`)] : [])).sort((a, b) => b.value - a.value);
  const altitudes = charted.flatMap((d) => (d.kind === "drone" && d.altitudeM ? [item(d, d.altitudeM, `${d.oblique ? "Oblique" : "Nadir"} · ${formatDate(d.date)}`)] : [])).sort((a, b) => b.value - a.value);
  const when = charted.filter((d) => d.date).map((d) => ({ ...item(d, 0, d.site), date: d.date }));
  const licenseCounts = [...items.reduce((m, d) => m.set(d.license ?? "Not stated", (m.get(d.license ?? "Not stated") ?? 0) + 1), new Map<string, number>())];
  const licenses = licenseCounts.sort((a, b) => b[1] - a[1]).map(([name, n]): ChartItem => ({ id: name, label: name, kind: "drone", value: n, detail: plural(n, "record") }));

  const drones = items.filter((d) => d.kind === "drone").length;
  const years = items.map((d) => d.year).filter((y): y is number => y !== null);
  const totalHa = items.reduce((sum, d) => sum + (area(d) ?? 0), 0);

  return (
    <div className="flex-1">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-5 pt-4">
        <nav aria-label="Breadcrumb" className="flex flex-1 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/data" className="text-foreground hover:underline">Data</Link>
          <ChevronRightIcon className="size-3.5" aria-hidden />
          <Link href="/data/catalog" className="text-foreground hover:underline">All datasets</Link>
          <ChevronRightIcon className="size-3.5" aria-hidden />
          <span aria-current="page">Compare</span>
        </nav>
        <CatalogSwitcher />
      </div>

      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 pt-6 pb-20">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-[clamp(22px,3vw,28px)] leading-tight font-semibold tracking-[-0.02em]">Compare records</h1>
          <p className="max-w-[70ch] text-sm text-muted-foreground">The records in your collection, side by side. Add or remove records from the catalog and they update here.</p>
        </header>

        {catalogLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : catalogError ? (
          <p role="alert">{catalogError} <button type="button" onClick={reloadCatalog} className="underline">Retry</button></p>
        ) : items.length < 2 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6">
            <p className="text-sm">Add at least two records to your collection to compare them. Tick rows in the catalog table, or use the select-all box in its header.</p>
            <Button asChild><Link href="/data/catalog">Go to the catalog</Link></Button>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4">
              <Tile label="Records" value={items.length.toLocaleString()} sub={`${plural(drones, "drone mission")}, ${plural(items.length - drones, "ground plot")}`} />
              <Tile label="Total area" value={`${totalHa.toLocaleString(undefined, { maximumFractionDigits: 1 })} ha`} />
              <Tile label="Collected" value={years.length ? (Math.min(...years) === Math.max(...years) ? String(years[0]) : `${Math.min(...years)} to ${Math.max(...years)}`) : "—"} />
              <Tile label="Licenses" value={String(licenses.length)} sub={licenses.map((l) => l.label).join(", ")} />
            </dl>

            {items.length > MAX_CHARTED && (
              <p className="text-sm text-muted-foreground" role="status">Charts show the first {MAX_CHARTED} of {items.length} records. The table below lists all of them.</p>
            )}

            <div className="grid items-start gap-5 lg:grid-cols-2">
              <ChartCard title="When each record was collected" note="Oldest at the top. Hover or focus a row for the exact date." kinds={kindsOf(charted)}>
                <DotTimeline items={when} />
              </ChartCard>
              <ChartCard title="Area covered" note="Hectares, from zero. Plots are small next to flights, so most plot bars will be short." kinds={kindsOf(charted)}>
                <BarList items={areas} unit="ha" />
              </ChartCard>
              {trees.length > 0 && (
                <ChartCard title="Trees mapped per plot" note="Stems measured on the ground." kinds={["ground"]}>
                  <BarList items={trees} unit="trees" />
                </ChartCard>
              )}
              {altitudes.length > 0 && (
                <ChartCard title="Flight altitude" note="Metres above ground. Lower flights see more detail per tree." kinds={["drone"]}>
                  <BarList items={altitudes} unit="m" />
                </ChartCard>
              )}
              <ChartCard title="Licenses" note="How many of these records fall under each license. Check them before combining records.">
                <BarList items={licenses} unit="" tone="neutral" />
              </ChartCard>
            </div>

            <section aria-label="All values" className="overflow-hidden rounded-xl border bg-card">
              <div className="flex min-h-[52px] items-center gap-3 border-b px-5 py-2.5">
                <h2 className="flex-1 text-[15px] font-semibold">Every value</h2>
                <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => setInCollection(items.map((d) => d.id), false)}>Clear collection</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-[13px] tabular-nums">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      {["Name", "Type", "Date", "Area", "Trees / altitude", "License", "Trust", ""].map((h) => (
                        <th key={h || "remove"} scope="col" className="border-b px-3 py-2 font-medium first:pl-5 last:pr-5">{h || <span className="sr-only">Remove</span>}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((d) => {
                      const t = trustFor(d, catalog);
                      return (
                        <tr key={d.id} className="border-b border-border/60 last:border-0">
                          <td className="max-w-[260px] truncate py-2.5 pr-3 pl-5"><Link href={`/data/datasets/${d.id}`} className="font-medium hover:underline">{d.name}</Link></td>
                          <td className="px-3"><span className="inline-flex items-center gap-1.5"><ChartMark kind={d.kind} />{d.kind === "drone" ? "Drone" : "Ground"}</span></td>
                          <td className="px-3 whitespace-nowrap">{d.date || "—"}</td>
                          <td className="px-3 whitespace-nowrap">{areaLabel(d)}</td>
                          <td className="px-3 whitespace-nowrap">{d.kind === "ground" ? plural(d.trees, "tree") : d.altitudeM ? `${d.altitudeM} m` : "—"}</td>
                          <td className="px-3 whitespace-nowrap">{d.license ?? "—"}</td>
                          <td className="px-3 whitespace-nowrap">{t.passed}/{t.total} {t.level}</td>
                          <td className="py-2 pr-5 pl-3 text-right"><Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => toggleCollection(d.id)}>Remove</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
