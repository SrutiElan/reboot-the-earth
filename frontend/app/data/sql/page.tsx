import type { Metadata } from "next";
import { SqlQueryView } from "@/components/catalog/sql-query-view";

export const metadata: Metadata = {
  title: "SQL query | Open Forest Observatory",
  description: "Run read-only SQL queries against the local OFO PostGIS dataset.",
};

export default function SqlQueryPage() {
  return <SqlQueryView />;
}
