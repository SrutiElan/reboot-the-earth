"use client";

import Link from "next/link";
import type { Dataset } from "@/lib/catalog";
import { datasetFileUrl, downloadRows } from "@/lib/api";
import { plural } from "@/lib/catalog/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCatalog } from "./catalog-provider";
import { KindMark } from "./kind-mark";
import { useCopy } from "./use-copy";

export function CollectionSheet() {
  const { catalog, sheet, setSheet, collection, toggleCollection } = useCatalog();
  const [copied, copy] = useCopy();
  const items = collection.map((id) => catalog.byId(id)).filter((d): d is Dataset => !!d);

  const python = `import requests\n\nurls = ${JSON.stringify(items.map((d) => datasetFileUrl(d.id, "metadata.json")), null, 2)}\nitems = [requests.get(url).json() for url in urls]`;

  const downloadManifest = () => {
    const columns = ["id", "name", "type", "project", "date", "license", "contributors", "metadata_url"];
    downloadRows(items.map((d) => ({ id: d.id, name: d.name, type: d.kind, project: d.site, date: d.date, license: d.license, contributors: d.contributors, metadata_url: datasetFileUrl(d.id, "metadata.json") })), columns, "ofo-collection.csv");
  };

  return (
    <Sheet open={sheet === "collection"} onOpenChange={(o) => setSheet(o ? "collection" : null)}>
      <SheetContent className="w-full gap-0 sm:max-w-[420px]">
        <SheetHeader className="border-b px-6 pt-5 pb-4">
          <SheetTitle className="text-lg font-semibold">Collection</SheetTitle>
          <SheetDescription>{plural(items.length, "dataset")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="max-w-[34ch] px-6 py-6 text-sm leading-relaxed text-muted-foreground">
              Check datasets in the table, or use Add to collection on a dataset page, to download them together.
            </p>
          ) : (
            <ul>
              {items.map((d) => (
                <li key={d.id} className="flex items-center gap-3 border-b border-border/60 px-6 py-3">
                  <KindMark kind={d.kind} className="size-[9px]" />
                  <Link
                    href={`/data/datasets/${d.id}`}
                    onClick={() => setSheet(null)}
                    className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="block truncate text-sm font-medium">{d.name}</span>
                    <span className="flex gap-3 text-xs text-muted-foreground tabular-nums">
                      <span>{d.id}</span>
                      <span className="truncate">{d.site}</span>
                      <span>{d.date}</span>
                    </span>
                  </Link>
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => toggleCollection(d.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <SheetFooter className="grid grid-cols-2 gap-2 border-t px-6 py-4">
          <Button variant="outline" className="h-10" disabled={!items.length} onClick={() => copy(python, "py")}>
            {copied === "py" ? "Copied" : "Copy Python"}
          </Button>
          <Button className="h-10 hover:bg-primary-hover" disabled={!items.length} onClick={downloadManifest}>
            Download manifest
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
