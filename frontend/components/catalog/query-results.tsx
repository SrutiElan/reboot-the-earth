"use client";

import type { QueryData } from "@/lib/catalog/assistant";
import { downloadRows } from "@/lib/api";

export function QueryResults({ data, preview = false, bare = false }: { data: QueryData; preview?: boolean; bare?: boolean }) {
  const rows = preview ? data.rows.slice(0, 5) : data.rows;
  const value = (v: unknown) => v == null ? "NULL" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      {!bare && <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2 text-xs">
        <span>{data.row_count.toLocaleString()} rows · {data.elapsed_ms} ms {data.truncated ? "· first 1,000 rows" : ""}</span>
        <button type="button" className="shrink-0 font-medium text-primary underline underline-offset-2" onClick={() => downloadRows(data.rows, data.columns, "ofo-query-results.csv")}>Export CSV</button>
      </div>}
      <div className={preview ? "max-h-64 overflow-auto" : "min-h-0 flex-1 overflow-auto"}>
        <table className="w-full border-collapse text-left text-xs tabular-nums">
          <thead className="sticky top-0 bg-background">
            <tr>{data.columns.map((c) => <th key={c} className="whitespace-nowrap border-b px-3 py-2 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>{rows.map((row, i) => <tr key={i} className="border-b last:border-0 hover:bg-muted/40">{data.columns.map((c) => <td key={c} className="max-w-80 px-3 py-2 align-top break-words font-mono whitespace-pre-wrap">{value(row[c])}</td>)}</tr>)}</tbody>
        </table>
        {!rows.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No rows matched these criteria.</p>}
      </div>
      {preview && data.row_count > 5 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Preview: first 5 rows. Full results are in the Data panel.</p>}
    </div>
  );
}
