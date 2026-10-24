"use client";

import { XIcon } from "lucide-react";
import { filterChips } from "@/lib/catalog/filters";
import { ASSISTANT_NAME } from "@/lib/catalog/assistant";
import { useCatalog } from "./catalog-provider";

export function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex h-[28px] items-center gap-0.5 rounded-full bg-muted pr-1 pl-3 text-[13px] font-medium whitespace-nowrap">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="flex rounded-full p-1 text-muted-foreground hover:text-foreground"
      >
        <XIcon className="size-3" strokeWidth={2.5} />
      </button>
    </span>
  );
}

/** The filters and AI picks currently narrowing the catalog. Renders nothing when there are none. */
export function ActiveFilters() {
  const { filters, patchFilters, pick, clearPick, clearAll } = useCatalog();
  const chips = filterChips(filters);
  if (!chips.length && !pick) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pick && <Chip label={pick.label ? `${pick.label}, from ${ASSISTANT_NAME}` : `Picked by ${ASSISTANT_NAME}`} onRemove={clearPick} />}
      {chips.map((c) => (
        <Chip key={c.id} label={c.label} onRemove={() => patchFilters(c.clear)} />
      ))}
      <button type="button" onClick={clearAll} className="h-[28px] rounded-md px-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        Clear all
      </button>
    </div>
  );
}
