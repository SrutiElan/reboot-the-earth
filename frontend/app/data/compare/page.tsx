import type { Metadata } from "next";
import { CompareView } from "@/components/catalog/compare-view";

export const metadata: Metadata = { title: "Compare records | Open Forest Observatory" };

export default function ComparePage() {
  return <CompareView />;
}
