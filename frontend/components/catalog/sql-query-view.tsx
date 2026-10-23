"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const EXAMPLES = [
  {
    label: "Plots",
    sql: `SELECT plot_id, project_name, plot_area_ha, plot_lat, plot_lon
FROM ofo_plots
ORDER BY plot_id
LIMIT 25;`,
  },
  {
    label: "Trees under 10 m",
    sql: `SELECT plot_id, species_code, dbh, height, live_dead,
       ST_AsGeoJSON(geom) AS geom_geojson
FROM ofo_trees
WHERE height <= 10
ORDER BY height NULLS LAST
LIMIT 50;`,
  },
  {
    label: "Drone missions",
    sql: `SELECT mission_id, project_name, aircraft_model_name,
       image_count_derived, ST_AsGeoJSON(geom) AS geom_geojson
FROM ofo_drone_missions
ORDER BY mission_id
LIMIT 25;`,
  },
];

type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
  elapsed_ms: number;
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function SqlQueryView() {
  const [sql, setSql] = useState(EXAMPLES[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runQuery() {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/sql/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "The query could not be completed");
      setResult(body as QueryResult);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "The query could not be completed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-5 pt-10 pb-24">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Data tools / SQL</p>
            <h1 className="text-[clamp(36px,5vw,52px)] leading-[1.05] font-semibold tracking-[-0.03em]">
              Query the forest database
            </h1>
          </div>
          <Link href="/data" className="text-sm font-medium text-primary underline underline-offset-4">
            Back to data
          </Link>
        </div>
        <p className="max-w-[52rem] text-base leading-relaxed text-muted-foreground">
          Write a SQL query against the local OFO PostGIS tables and inspect the returned rows directly in the browser.
          Queries are read-only, limited to 1,000 returned rows, and stopped after five seconds.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-surface p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="sql-query" className="text-sm font-semibold">
              SQL query
            </label>
            <span className="text-xs text-muted-foreground">SELECT / WITH only</span>
          </div>
          <textarea
            id="sql-query"
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            spellCheck={false}
            className="min-h-[260px] w-full resize-y rounded-xl border bg-background px-4 py-3 font-mono text-[13px] leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="SQL query"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Writes, multiple statements, and administrative commands are rejected by the API.
            </p>
            <Button type="button" onClick={runQuery} disabled={isRunning || !sql.trim()} className="min-w-28">
              {isRunning ? "Running…" : "Run query"}
            </Button>
          </div>
          {error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-3 rounded-2xl border bg-background p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Example queries</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Load an example into the editor, then adjust it for your question.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => {
                  setSql(example.sql);
                  setError(null);
                  setResult(null);
                }}
                className="rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-muted"
              >
                {example.label}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
            Tables: <code className="font-mono">ofo_plots</code>, <code className="font-mono">ofo_trees</code>, and{" "}
            <code className="font-mono">ofo_drone_missions</code>.
          </div>
        </aside>
      </section>

      <section className="flex min-h-64 flex-col gap-4 rounded-2xl border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold">Results</h2>
            {result ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {result.row_count.toLocaleString()} rows · {result.elapsed_ms} ms
                {result.truncated ? " · showing the first 1,000 rows" : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Run a query to see its result set.</p>
            )}
          </div>
          {result?.truncated ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Result truncated
            </span>
          ) : null}
        </div>

        {result ? (
          result.rows.length > 0 ? (
            <div className="overflow-auto rounded-xl border">
              <table className="min-w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column} className="whitespace-nowrap border-b px-3 py-2 font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b last:border-b-0 hover:bg-muted/40">
                      {result.columns.map((column) => (
                        <td key={`${rowIndex}-${column}`} className="max-w-[360px] whitespace-pre-wrap px-3 py-2 align-top font-mono">
                          {displayValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">The query returned no rows.</p>
          )
        ) : (
          <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
            Query results will appear here.
          </div>
        )}
      </section>
    </main>
  );
}
