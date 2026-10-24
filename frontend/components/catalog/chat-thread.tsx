"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpIcon, CheckIcon } from "lucide-react";
import type { Dataset } from "@/lib/catalog";
import { plural } from "@/lib/catalog/format";
import { EMPTY_FILTERS, filterChips } from "@/lib/catalog/filters";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";
import { useCatalog } from "./catalog-provider";
import { KindMark } from "./kind-mark";
import { QueryResults } from "./query-results";

function previewMeta(d: Dataset) {
  return d.kind === "drone"
    ? [d.id, d.site, d.date, plural(d.overlaps.length, "plot")]
    : [d.site, d.date, plural(d.trees, "tree")];
}

// The conversation shown in the assistant panel.
export function ChatThread() {
  const { catalog, messages, busy, progress, cancelQuery, appliedIdx, applyAnswer, ask, setHoverId, undoAdd, confirmAnswer, dismissAnswer } = useCatalog();
  const end = useRef<HTMLDivElement>(null);
  const lastAi = messages.findLastIndex((m) => m.role === "ai");

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      {messages.map((m, i) => {
        if (m.role === "user") {
          return (
            <p
              key={i}
              className={cn(
                "max-w-[88%] self-end rounded-xl bg-muted px-3.5 py-2 text-[13px] leading-[1.55] [overflow-wrap:anywhere]",
              )}
            >
              {m.text}
            </p>
          );
        }
        const a = m.answer;
        const preview = a.preview.map((id) => catalog.byId(id)).filter((d): d is Dataset => !!d);
        const applied = appliedIdx === i;
        const total = a.apply?.ids?.length ?? 0;
        return (
          <div key={i} className="flex flex-col gap-3">
            <div role={a.status === "failed" ? "alert" : undefined} className={cn(a.status === "failed" && "text-red-700 dark:text-red-300")}>
              <Markdown>{a.text}</Markdown>
            </div>
            {a.data && <QueryResults data={a.data} preview />}
            {(a.sql || a.attempts.length > 0) && <details className="rounded-lg border p-3 text-xs">
              <summary className="cursor-pointer font-medium">SQL & query attempts ({a.attempts.length})</summary>
              {a.attempts.map((attempt) => <div key={attempt.attempt} className="mt-3 border-t pt-3">
                <p className="mb-2 text-muted-foreground">Attempt {attempt.attempt}{attempt.row_count !== undefined ? ` · ${attempt.row_count} rows` : ""} · {attempt.decision ?? "error"}</p>
                <pre className="max-h-64 overflow-auto font-mono whitespace-pre-wrap">{attempt.sql}</pre>
                {attempt.error && <p className="mt-2 text-red-700 dark:text-red-300">{attempt.error}</p>}
                {attempt.feedback && <p className="mt-2 text-muted-foreground">{attempt.feedback}</p>}
              </div>)}
              {a.model && <p className="mt-3 text-muted-foreground">{a.model}</p>}
            </details>}
            {a.pending && (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3.5" role="group" aria-label="Confirm before applying">
                <p className="text-[13px] font-medium">Apply these to the catalog?</p>
                <ul className="flex flex-col gap-2 text-[13px]">
                  {a.actions.map((x, n) => (
                    <li key={n}>
                      {x.type === "set_filters" && (
                        <span className="flex flex-wrap gap-1.5">
                          {filterChips({ ...EMPTY_FILTERS, ...x.filters }).map((c) => (
                            <span key={c.id} className="rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium">{c.label}</span>
                          ))}
                        </span>
                      )}
                      {x.type === "add_to_collection" && <span className="text-muted-foreground">Add {plural(x.ids.length, "record")} to your collection</span>}
                      {x.type === "open_dataset" && <span className="text-muted-foreground">Open {x.dataset_id}</span>}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 px-3 hover:bg-primary-hover" onClick={() => confirmAnswer(i)}>Apply</Button>
                  <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => dismissAnswer(i)}>Cancel</Button>
                </div>
              </div>
            )}
            {a.dismissed && <p className="text-xs text-muted-foreground">Cancelled. Nothing was changed.</p>}
            {!a.pending && !a.dismissed && a.actions.length > 0 && (
              <ul className="flex flex-col gap-1.5 rounded-lg border bg-muted/40 px-3.5 py-3 text-[13px]" aria-label="Actions taken">
                {a.actions.map((x, n) => (
                  <li key={n} className="flex items-center gap-2">
                    <CheckIcon className="size-3.5 shrink-0 text-primary dark:text-drone-ink" aria-hidden />
                    <span className="min-w-0 flex-1">
                      {x.type === "add_to_collection" &&
                        (a.undone
                          ? "Collection change undone"
                          : a.added?.length
                            ? `Added ${plural(a.added.length, "record")} to your collection`
                            : "Those records were already in your collection")}
                      {x.type === "set_filters" && `Applied ${plural(filterChips({ ...EMPTY_FILTERS, ...x.filters }).length, "filter")}`}
                      {x.type === "open_dataset" && `Opened ${x.dataset_id}`}
                    </span>
                    {x.type === "add_to_collection" && !a.undone && !!a.added?.length && (
                      <button type="button" onClick={() => undoAdd(i)} className="font-medium text-primary underline-offset-2 hover:underline dark:text-drone-ink">
                        Undo
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!a.pending && (preview.length > 0 || a.apply) && (
              <div className="overflow-hidden rounded-lg border">
                {preview.map((d) => (
                  <Link
                    key={d.id}
                    href={`/data/datasets/${d.id}`}
                    onMouseEnter={() => setHoverId(d.id)}
                    onMouseLeave={() => setHoverId(null)}
                    className="flex items-center gap-3 border-b border-border/60 px-3.5 py-2.5 outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
                  >
                    <KindMark kind={d.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{d.name}</span>
                      <span className="flex gap-2.5 truncate text-xs text-muted-foreground tabular-nums">
                        {previewMeta(d).map((x) => (
                          <span key={x}>{x}</span>
                        ))}
                      </span>
                    </span>
                  </Link>
                ))}
                {a.apply && (
                  <button
                    type="button"
                    onClick={() => applyAnswer(a.apply!, i)}
                    disabled={applied}
                    className={cn(
                      "flex min-h-10 w-full items-center justify-center px-3 py-2 text-[13px] font-medium text-primary dark:text-drone-ink",
                      applied ? "bg-selected" : "bg-muted/50 hover:bg-selected",
                    )}
                  >
                    {applied ? "Showing these results on the map" : `Show ${plural(total, "result")} on the map`}
                  </button>
                )}
              </div>
            )}
            {i === lastAi && !a.pending && a.follow.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {a.follow.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => ask(f)}
                    className="min-h-7 rounded-full border bg-background px-3 py-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {busy && <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{progress || "Querying the database…"}</span><button type="button" onClick={cancelQuery} className="underline">Stop</button></div>}
      <div ref={end} />
    </div>
  );
}

export function ChatInput({ placeholder }: { placeholder: string }) {
  const { ask, busy } = useCatalog();
  const input = useRef<HTMLInputElement>(null);

  const send = () => {
    const v = input.current?.value ?? "";
    if (!v.trim() || busy) return;
    ask(v);
    if (input.current) input.current.value = "";
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex items-center gap-2 rounded-[10px] border border-input bg-background py-1 pr-1 pl-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30"
    >
      <input
        ref={input}
        aria-label="Ask about the catalog"
        placeholder={placeholder}
        className="h-[34px] min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={busy}
        className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <ArrowUpIcon className="size-4" />
      </button>
    </form>
  );
}
