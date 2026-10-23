import { CatalogProvider } from "@/components/catalog/catalog-provider";
import { CollectionSheet } from "@/components/catalog/collection-sheet";
import { Suspense } from "react";

export default function DataLayout({ children }: LayoutProps<"/data">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted-foreground">Loading forest data…</p>}><CatalogProvider>
      {children}
      <CollectionSheet />
    </CatalogProvider></Suspense>
  );
}
