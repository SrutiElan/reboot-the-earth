import { CatalogProvider } from "@/components/catalog/catalog-provider";
import { CollectionSheet } from "@/components/catalog/collection-sheet";

export default function DataLayout({ children }: LayoutProps<"/data">) {
  return (
    <CatalogProvider>
      {children}
      <CollectionSheet />
    </CatalogProvider>
  );
}
