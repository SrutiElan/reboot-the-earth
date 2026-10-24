"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, FileJsonIcon, UploadIcon } from "lucide-react";
import { API_BASE, apiJson } from "@/lib/api";
import { STATUS_LABELS, type SubmissionReport, type SubmissionSummary } from "@/lib/uploads";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";

const MAX_BYTES = 1024 * 1024;
const FIELD_GUIDE = [
  ["Package", "schema_version, package_id, title, project_name, contributor, license, rights_confirmed, crs, units"],
  ["plots[]", "plot_id, survey_date (YYYY-MM-DD), longitude, latitude; optional area_ha, boundary, date_approximate"],
  ["trees[]", "tree_id, plot_id, longitude, latitude; at least one of height or dbh; optional species_code, live_dead"],
  ["missions[]", "mission_id, name, date, boundary; optional aircraft, altitude_m, camera_pitch, image_count, withheld"],
];

const cell = (value: unknown) => JSON.stringify(value) ?? "null";

export function UploadView() {
  const { reloadCatalog } = useCatalog();
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<SubmissionReport | null>(null);
  const [recent, setRecent] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"review" | "import" | "load" | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resultArea = useRef<HTMLElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    apiJson<SubmissionSummary[]>("/api/uploads", { signal: controller.signal })
      .then(setRecent).catch(() => { /* Upload remains usable if history cannot load. */ });
    return () => controller.abort();
  }, []);

  function remember(next: SubmissionReport) {
    setReport(next);
    setRecent((items) => [next, ...items.filter((item) => item.id !== next.id)].slice(0, 20));
    requestAnimationFrame(() => resultArea.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function readFile(file: File) {
    if (busyRef.current) return;
    setError(null);
    if (file.size > MAX_BYTES) { setError("Choose a JSON file no larger than 1 MiB."); return; }
    try {
      const text = await file.text();
      setContent(text.replace(/^\uFEFF/, ""));
      setFileName(file.name);
      setReport(null);
    } catch { setError("The file could not be read. Choose a UTF-8 JSON file."); }
  }

  async function loadTemplate() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("load");
    setError(null);
    try {
      const template = await apiJson<Record<string, unknown>>("/api/uploads/template");
      setContent(JSON.stringify(template, null, 2));
      setFileName("Example template — replace with your measured data");
      setReport(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load the template"); }
    finally { busyRef.current = false; setBusy(null); }
  }

  async function review() {
    if (busyRef.current) return;
    setError(null);
    if (new TextEncoder().encode(content).length > MAX_BYTES) { setError("JSON packages must be 1 MiB or smaller."); return; }
    try { JSON.parse(content); }
    catch (reason) { setError(`Invalid JSON: ${reason instanceof Error ? reason.message : "check the syntax"}`); return; }
    busyRef.current = true;
    setBusy("review");
    setReport(null);
    try {
      remember(await apiJson<SubmissionReport>("/api/uploads/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: content }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The review could not be completed"); }
    finally { busyRef.current = false; setBusy(null); }
  }

  async function importPackage() {
    if (!report || busyRef.current) return;
    busyRef.current = true;
    setBusy("import");
    setError(null);
    try {
      remember(await apiJson<SubmissionReport>(`/api/uploads/${report.id}/import`, { method: "POST" }));
      reloadCatalog();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The import could not be completed"); }
    finally { busyRef.current = false; setBusy(null); }
  }

  async function openReport(id: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("load");
    setError(null);
    try { remember(await apiJson<SubmissionReport>(`/api/uploads/${id}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load the review"); }
    finally { busyRef.current = false; setBusy(null); }
  }

  const canImport = report?.status === "ready" || report?.status === "ready_with_cleaning";

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-5 pt-10 pb-24">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-primary">Contribute / JSON v1.0</p>
          <Link href="/data/catalog" className="text-sm text-primary underline underline-offset-4">Browse the catalog</Link>
        </div>
        <h1 className="text-[clamp(36px,5vw,52px)] leading-[1.05] font-semibold tracking-[-0.03em]">Bring your forest data.</h1>
        <p className="max-w-[50rem] text-base leading-relaxed text-muted-foreground">
          Submit a small JSON package of plots, tree measurements or drone missions. Our agent checks compatibility,
          applies supported minor fixes and shows the result before you import anything.
        </p>
        <ol className="grid gap-3 pt-2 sm:grid-cols-3">
          {[["01", "Submit", "Follow the schema or start with a template."], ["02", "Review & clean", "Inspect validation results and every applied change."], ["03", "Import", "Add approved records to the live catalog."]].map(([n, title, text]) => (
            <li key={n} className="flex gap-3 rounded-xl border bg-surface px-4 py-3"><span className="font-mono text-sm text-primary">{n}</span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div></li>
          ))}
        </ol>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your data package</h2><Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={loadTemplate}>Load example</Button></div>
          <div
            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-5 py-7 text-center transition ${dragging ? "border-primary bg-selected" : "border-border bg-surface"}`}
            onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files[0]) void readFile(event.dataTransfer.files[0]); }}
          >
            <UploadIcon className="size-6 text-primary" />
            <p className="text-sm font-medium">Drop a JSON file here</p>
            <p className="text-xs text-muted-foreground">UTF-8 · up to 1 MiB · or paste JSON below</p>
            <input ref={input} type="file" accept=".json,application/json" disabled={!!busy} className="sr-only" aria-label="Choose a JSON data package" onChange={(event) => { if (event.target.files?.[0]) void readFile(event.target.files[0]); event.target.value = ""; }} />
            <Button type="button" variant="outline" size="sm" className="mt-2" disabled={!!busy} onClick={() => input.current?.click()}>Choose file</Button>
          </div>
          {fileName && <p className="flex items-center gap-2 text-xs text-muted-foreground"><FileJsonIcon className="size-4 shrink-0" />{fileName}</p>}
          <label htmlFor="package-json" className="text-sm font-medium">JSON contents</label>
          <textarea id="package-json" aria-label="JSON data package" value={content} disabled={!!busy} spellCheck={false}
            onChange={(event) => { setContent(event.target.value); setReport(null); setFileName(null); }}
            placeholder={'{\n  "schema_version": "1.0",\n  "package_id": "your-package-id",\n  ...\n}'}
            className="min-h-[360px] w-full resize-y rounded-xl border bg-background p-4 font-mono text-xs leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70" />
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-[28rem] text-xs leading-relaxed text-muted-foreground">Review sends metadata and a bounded sample to OpenAI. Your catalog is updated only when you import an approved package.</p><Button type="button" disabled={!!busy || !content.trim()} onClick={review}>{busy === "review" ? "Reviewing & validating…" : "Review package"}</Button></div>
          {busy === "review" && <p role="status" className="rounded-lg bg-selected px-3 py-2 text-sm text-primary">Checking all records, evaluating safe cleaning and requesting the agent&apos;s review…</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
        </section>

        <aside className="flex flex-col gap-5">
          <section className="rounded-2xl border bg-surface p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">The data contract</h2><span className="rounded-full border bg-background px-2 py-1 font-mono text-xs">v1.0</span></div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Coordinates use EPSG:4326. GeoJSON positions are [longitude, latitude]. Include at least one record; every tree must reference a plot in this package.</p>
            <dl className="mt-4 flex flex-col gap-4">{FIELD_GUIDE.map(([name, fields]) => <div key={name}><dt className="font-mono text-xs font-semibold">{name}</dt><dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{fields}</dd></div>)}</dl>
            <p className="mt-4 border-t pt-4 text-xs leading-relaxed text-muted-foreground">Declare height units (m, cm, ft) and DBH units (cm, mm, in). Licensed submissions: CC0-1.0, CC-BY-4.0 or CC-BY-SA-4.0, with rights_confirmed set to true.</p>
            <p className="mt-3 text-xs text-muted-foreground">Maximum: 200 plots, 5,000 trees and 200 missions per package.</p>
            <div className="mt-5 flex flex-col gap-2"><Button asChild variant="outline"><a href={`${API_BASE}/api/uploads/schema`}>Download JSON Schema</a></Button><Button asChild variant="outline"><a href={`${API_BASE}/api/uploads/template`}>Download template</a></Button></div>
          </section>
          <section className="rounded-2xl border p-5"><h2 className="text-sm font-semibold">What can be cleaned?</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Whitespace, numeric strings, explicit units, known live/dead labels, optional empty values and unambiguous date formats. Measurements, coordinates, units or species are never invented.</p><p className="mt-3 text-xs leading-relaxed text-muted-foreground">A plot can contain just its measured center point. Missing footprints and plot areas remain unknown.</p></section>
        </aside>
      </div>

      {report && <section ref={resultArea} className="scroll-mt-5 rounded-2xl border bg-card p-4 sm:p-6" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">Review result · {report.id.slice(0, 8)}</p><h2 className="mt-2 text-2xl font-semibold">{report.title}</h2></div><span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${canImport || report.status === "imported" ? "border-primary/30 bg-selected text-primary" : "bg-muted text-foreground"}`}>{STATUS_LABELS[report.status]}</span></div>
        <p className="mt-4 max-w-[65rem] text-sm leading-relaxed">{report.summary || "This submission is still being reviewed. Open it again shortly."}</p>
        <div className="mt-5 flex flex-wrap gap-3">{Object.entries(report.counts ?? {}).map(([name, count]) => <div key={name} className="min-w-28 rounded-xl border bg-surface px-4 py-3"><p className="text-2xl font-semibold tabular-nums">{count?.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{name}</p></div>)}{report.change_count > 0 && <div className="rounded-xl border bg-selected px-4 py-3"><p className="text-2xl font-semibold tabular-nums">{report.change_count}</p><p className="mt-1 text-xs text-muted-foreground">safe changes applied</p></div>}</div>
        {!!report.checks?.length && <div className="mt-5 flex flex-wrap gap-3 text-xs">{report.checks.map((check) => <p key={check.name} className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-2">{check.status === "passed" && <CheckCircle2Icon className="size-3.5 text-primary" />}{check.name}: {check.status}</p>)}</div>}
        {!!report.errors?.length && <div className="mt-5 overflow-auto rounded-xl border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr><th className="px-3 py-2">Field</th><th className="px-3 py-2">Issue to fix</th></tr></thead><tbody>{report.errors.map((issue, i) => <tr key={i} className="border-t"><td className="px-3 py-2 align-top font-mono">{issue.path}</td><td className="px-3 py-2">{issue.message}</td></tr>)}</tbody></table></div>}
        {!!report.findings?.length && <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{report.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul>}
        {report.change_count > 0 && <details open className="mt-6"><summary className="cursor-pointer text-sm font-semibold">Cleaning audit ({report.change_count} changes)</summary><div className="mt-3 max-h-80 overflow-auto rounded-xl border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{["Field", "Before", "After", "Operation"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{report.changes.map((change, i) => <tr key={i} className="border-t"><td className="px-3 py-2 align-top font-mono">{change.path}</td><td className="max-w-72 break-all px-3 py-2 font-mono">{cell(change.before)}</td><td className="max-w-72 break-all px-3 py-2 font-mono">{cell(change.after)}</td><td className="px-3 py-2">{change.operation.replaceAll("_", " ")}</td></tr>)}</tbody></table></div>{report.change_count > 200 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 200 changes. Download the full audit for every before/after value.</p>}</details>}
        {!!Object.keys(report.preview ?? {}).length && <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">Normalized data preview</summary><pre className="mt-3 max-h-80 overflow-auto rounded-xl border bg-surface p-4 font-mono text-xs leading-relaxed">{JSON.stringify(report.preview, null, 2)}</pre></details>}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
          {canImport && <Button type="button" disabled={!!busy} onClick={importPackage}>{busy === "import" ? "Importing transaction…" : "Import approved data"}</Button>}
          {(canImport || report.status === "imported") && <><Button asChild variant="outline"><a href={`${API_BASE}/api/uploads/${report.id}/normalized`}>Download normalized JSON</a></Button><Button asChild variant="outline"><a href={`${API_BASE}/api/uploads/${report.id}/audit`}>Download full audit</a></Button></>}
          {report.status === "imported" && <p className="flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2Icon className="size-4" />All records imported successfully.</p>}
          {report.catalog_ids?.slice(0, 5).map((id) => <Link key={id} href={`/data/datasets/${id}`} className="text-sm text-primary underline underline-offset-4">Open {id.startsWith("ground-") ? "plot" : "mission"}</Link>)}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{report.review_scope}{report.model ? ` Model: ${report.model}.` : ""}</p>
      </section>}

      {recent.length > 0 && <section className="rounded-2xl border p-4 sm:p-6"><h2 className="text-lg font-semibold">Recent submissions</h2><div className="mt-4 divide-y">{recent.map((item) => <button key={item.id} type="button" disabled={!!busy} onClick={() => openReport(item.id)} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:text-primary disabled:opacity-60"><span><span className="text-sm font-medium">{item.title}</span><span className="ml-3 font-mono text-xs text-muted-foreground">{item.id.slice(0, 8)}</span></span><span className="text-xs text-muted-foreground">{STATUS_LABELS[item.status]}</span></button>)}</div></section>}
    </div>
  );
}
