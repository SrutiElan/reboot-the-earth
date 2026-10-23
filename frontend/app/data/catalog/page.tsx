import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/catalog-view";

export const metadata: Metadata = { title: "All datasets | Open Forest Observatory" };

export default function CatalogPage() {
  return <CatalogView />;
}
