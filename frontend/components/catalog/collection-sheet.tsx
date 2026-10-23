"use client";

import Link from "next/link";
import { catalog, stacUrl } from "@/lib/catalog";
import { plural } from "@/lib/catalog/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCatalog } from "./catalog-provider";
import { KindMark } from "./kind-mark";
import { useCopy } from "./use-copy";

export function CollectionSheet() {
  const { sheet, setSheet, collection, toggleCollection } = useCatalog();
  const [copied, copy] = useCopy();
  const items = collection.map((id) => catalog.byId(id)!);

  const python = `import pystac

ids = ${JSON.stringify(collection)}
items = [
    pystac.Item.from_file(f"https://stac.cyverse.org/ofo/items/{i}.json")
    for i in ids
]`;

  const downloadManifest = () => {
    const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
    const csv = [
      "id,name,type,site,date,stac_url",
      ...items.map((d) => [d.id, quote(d.name), d.kind, quote(d.site), d.date, stacUrl(d)].join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "ofo-collection.csv";
    a.click();
    URL.revokeObjectURL(a.href);
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
