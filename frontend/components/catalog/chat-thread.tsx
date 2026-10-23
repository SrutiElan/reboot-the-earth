"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpIcon } from "lucide-react";
import type { Dataset } from "@/lib/catalog";
import { plural } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";
import { useCatalog } from "./catalog-provider";
import { KindMark } from "./kind-mark";
import { QueryResults } from "./query-results";

function previewMeta(d: Dataset) {
  return d.kind === "drone"
    ? [d.id, d.site, d.date, plural(d.overlaps.length, "plot")]
    : [d.site, d.date, plural(d.trees, "tree")];
}

// The conversation, used full width on the assistant page and narrow in the dock.
export function ChatThread({ compact }: { compact?: boolean }) {
  const { catalog, messages, busy, progress, cancelQuery, appliedIdx, applyAnswer, ask, setHoverId } = useCatalog();
  const end = useRef<HTMLDivElement>(null);
  const lastAi = messages.findLastIndex((m) => m.role === "ai");

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  return (
    <div className={cn("flex flex-col", compact ? "gap-5" : "gap-6")} aria-live="polite">
      {messages.map((m, i) => {
        if (m.role === "user") {
          return (
            <p
              key={i}
              className={cn(
                "max-w-[85%] self-end rounded-xl bg-muted px-4 py-2.5 leading-relaxed",
                compact ? "text-sm" : "text-[15px]",
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
            <p role={a.status === "failed" ? "alert" : undefined} className={cn("leading-relaxed text-pretty whitespace-pre-wrap", compact ? "text-sm" : "text-[15px]", a.status === "failed" && "text-red-700 dark:text-red-300")}>{a.text}</p>
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
            {(preview.length > 0 || a.apply) && (
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
                    disabled={applied && compact}
                    className={cn(
                      "flex min-h-10 w-full items-center justify-center px-3 py-2 text-[13px] font-medium text-primary dark:text-drone-ink",
                      applied ? "bg-selected" : "bg-muted/50 hover:bg-selected",
                    )}
                  >
                    {applied && compact ? "Showing these results on the map" : `Show ${plural(total, "result")} on the map`}
                  </button>
                )}
              </div>
            )}
            {i === lastAi && a.follow.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {a.follow.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => ask(f)}
                    className="min-h-7 rounded-full border bg-background px-3 py-1 text-left text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
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

export function ChatInput({ placeholder, large, autoFocus }: { placeholder: string; large?: boolean; autoFocus?: boolean }) {
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
      className={cn(
        "flex items-center gap-2 border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30",
        large ? "rounded-xl py-1.5 pr-1.5 pl-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" : "rounded-[10px] py-1 pr-1 pl-3",
      )}
    >
      <input
        ref={input}
        autoFocus={autoFocus}
        aria-label="Ask about the catalog"
        placeholder={placeholder}
        className={cn(
          "min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground",
          large ? "h-9 text-[15px]" : "h-[34px] text-sm",
        )}
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={busy}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60",
          large ? "size-9" : "size-[34px]",
        )}
      >
        <ArrowUpIcon className="size-4" />
      </button>
    </form>
  );
}
