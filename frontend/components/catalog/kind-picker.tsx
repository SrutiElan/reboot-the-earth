"use client";

import { CheckIcon } from "lucide-react";
import { ALL_KINDS } from "@/lib/catalog/filters";
import type { DatasetKind } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { useCatalog } from "./catalog-provider";
import { KindMark } from "./kind-mark";

const LABEL: Record<DatasetKind, string> = { drone: "Drone missions", ground: "Ground plots" };

/** Which kinds of dataset to show. Any combination can be on; the ones that are off are greyed out. */
export function KindPicker({ inline = false }: { inline?: boolean }) {
  const { kinds, toggleKind } = useCatalog();

  return (
    <div role="group" aria-label="Dataset type" className={cn(inline ? "flex gap-2" : "flex flex-col gap-1")}>
      {!inline && <span className="mb-1 text-sm font-semibold">Dataset type</span>}
      {ALL_KINDS.map((k) => {
        const on = kinds.includes(k);
        const last = on && kinds.length === 1;
        return (
          <button
            key={k}
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-disabled={last || undefined}
            title={last ? "Keep at least one type selected" : undefined}
            onClick={() => toggleKind(k)}
            className={cn(
              "flex items-center gap-2.5 rounded-md text-sm transition-colors",
              inline ? "h-[38px] border px-3" : "h-9 px-2.5",
              on ? "bg-muted font-medium text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground",
              inline && !on && "border-dashed",
              last && "cursor-default",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-transparent",
              )}
            >
              {on && <CheckIcon className="size-3" strokeWidth={3} />}
            </span>
            <KindMark kind={k} className={cn(!on && "opacity-35 grayscale")} />
            {LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}
