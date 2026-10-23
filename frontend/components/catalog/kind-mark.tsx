import { cn } from "@/lib/utils";
import type { DatasetKind } from "@/lib/catalog";

// One symbol system everywhere: a teal square is a drone mission, an orange
// circle is a ground plot. It matches how each draws on the map.

export function KindMark({ kind, className }: { kind: DatasetKind; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0",
        kind === "drone" ? "rounded-[2px] bg-drone" : "rounded-full bg-ground",
        className,
      )}
    />
  );
}

export function KindBadge({ kind, long }: { kind: DatasetKind; long?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        kind === "drone" ? "bg-drone-tint text-drone-ink" : "bg-ground-tint text-ground-ink",
      )}
    >
      <KindMark kind={kind} className="size-[7px]" />
      {kind === "drone" ? (long ? "Drone mission" : "Drone") : long ? "Ground plot" : "Ground"}
    </span>
  );
}

export function WithheldBadge({ long }: { long?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border px-1.5 text-[11px] font-medium text-muted-foreground">
      {long ? "Withheld from training" : "Withheld"}
    </span>
  );
}
