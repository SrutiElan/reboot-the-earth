"use client";

import { useState } from "react";
import type { DatasetKind } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export interface ChartItem {
  id: string;
  label: string;
  kind: DatasetKind;
  value: number;
  /** What the tooltip shows after the value, e.g. a date or site. */
  detail?: string;
}

const KIND_LABEL: Record<DatasetKind, string> = { drone: "Drone mission", ground: "Ground plot" };

/** Square for drone missions, circle for ground plots, so type never depends on colour alone. */
export function ChartMark({ kind, className }: { kind: DatasetKind; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0", kind === "drone" ? "rounded-[2px] bg-chart-drone" : "rounded-full bg-chart-ground", className)}
    />
  );
}

function Legend({ kinds }: { kinds: DatasetKind[] }) {
  if (kinds.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <ChartMark kind={k} />
          {KIND_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}

interface Tip {
  x: number;
  y: number;
  item: ChartItem;
  value: string;
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[3000] max-w-[260px] -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
      style={{ left: tip.x, top: tip.y - 10 }}
    >
      <div className="text-sm font-semibold tabular-nums">{tip.value}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
        <ChartMark kind={tip.item.kind} className="size-2" />
        <span className="truncate">{tip.item.label}</span>
      </div>
      {tip.item.detail && <div className="mt-0.5 text-muted-foreground">{tip.item.detail}</div>}
    </div>
  );
}

/** Hover and keyboard focus show the same tooltip, so values never depend on the pointer. */
function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const bind = (item: ChartItem, value: string) => ({
    tabIndex: 0,
    onPointerMove: (e: React.PointerEvent) => setTip({ x: e.clientX, y: e.clientY, item, value }),
    onPointerLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, item, value });
    },
    onBlur: () => setTip(null),
  });
  return { tip, bind };
}

export function ChartCard({ title, note, kinds, children }: { title: string; note?: string; kinds?: DatasetKind[]; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {kinds && <Legend kinds={kinds} />}
      {children}
    </section>
  );
}

const compact = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(Math.round(n * 10) / 10));

/** One bar per record, from a shared zero. Only the longest bar (or every bar when there are few) is labelled; the rest live in the tooltip and the table. */
export function BarList({ items, unit, tone }: { items: ChartItem[]; unit: string; tone?: "kind" | "neutral" }) {
  const { tip, bind } = useTip();
  const max = Math.max(...items.map((i) => i.value), 0);
  const labelAll = items.length <= 8;
  if (!items.length || max <= 0) return <p className="text-sm text-muted-foreground">No values to show for these records.</p>;
  return (
    <div role="list" className="flex flex-col gap-1.5">
      {items.map((it) => {
        const text = `${it.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`.trim();
        const showValue = labelAll || it.value === max;
        return (
          <div key={it.id} role="listitem" {...bind(it, text)} className="group flex items-center gap-2 rounded-md py-0.5 outline-none focus-visible:bg-muted/60 hover:bg-muted/40">
            <span className="w-[34%] min-w-0 shrink-0 truncate text-xs text-muted-foreground" title={it.label}>{it.label}</span>
            <span className="flex min-w-0 flex-1 items-center gap-2 border-l border-border">
              <span
                className={cn(
                  "h-3.5 rounded-r-[4px]",
                  tone === "neutral" ? "bg-foreground/55" : it.kind === "drone" ? "bg-chart-drone" : "bg-chart-ground",
                )}
                style={{ width: `${Math.max(1, (it.value / max) * 82)}%`, minWidth: 2 }}
              />
              {showValue && <span className="text-xs font-medium tabular-nums">{compact(it.value)}</span>}
            </span>
          </div>
        );
      })}
      <div className="ml-[calc(34%+0.5rem)] flex justify-between pt-0.5 text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        <span>0</span>
        <span>{compact(max)} {unit}</span>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

const DAY = 864e5;
export const dateMs = (iso: string) => Date.parse(iso.length === 4 ? `${iso}-07-01` : iso.length === 7 ? `${iso}-15` : iso);

/** Each record as a mark on a shared date axis, oldest first. */
export function DotTimeline({ items }: { items: (ChartItem & { date: string })[] }) {
  const { tip, bind } = useTip();
  const dated = items.filter((i) => !Number.isNaN(dateMs(i.date))).sort((a, b) => dateMs(a.date) - dateMs(b.date));
  if (!dated.length) return <p className="text-sm text-muted-foreground">None of these records has a date.</p>;
  const lo = dateMs(dated[0].date) - 90 * DAY;
  const hi = dateMs(dated[dated.length - 1].date) + 90 * DAY;
  const at = (t: number) => `${((t - lo) / (hi - lo)) * 100}%`;
  const y0 = new Date(lo).getUTCFullYear() + 1;
  const y1 = new Date(hi).getUTCFullYear();
  const step = y1 - y0 > 12 ? 5 : y1 - y0 > 6 ? 2 : 1;
  const years: number[] = [];
  for (let y = y0; y <= y1; y += step) years.push(y);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative ml-[calc(34%+0.5rem)] h-4 text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        {years.map((y) => (
          <span key={y} className="absolute -translate-x-1/2" style={{ left: at(Date.UTC(y, 0, 1)) }}>{y}</span>
        ))}
      </div>
      <div role="list" className="flex flex-col gap-0.5">
        {dated.map((it) => (
          <div key={it.id} role="listitem" {...bind(it, it.date)} className="flex items-center gap-2 rounded-md py-0.5 outline-none focus-visible:bg-muted/60 hover:bg-muted/40">
            <span className="w-[34%] min-w-0 shrink-0 truncate text-xs text-muted-foreground" title={it.label}>{it.label}</span>
            <span className="relative h-3.5 min-w-0 flex-1">
              {years.map((y) => (
                <span key={y} aria-hidden className="absolute inset-y-0 w-px bg-border/70" style={{ left: at(Date.UTC(y, 0, 1)) }} />
              ))}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 ring-2 ring-card",
                  it.kind === "drone" ? "rounded-[2px] bg-chart-drone" : "rounded-full bg-chart-ground",
                )}
                style={{ left: at(dateMs(it.date)) }}
              />
            </span>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

export { Tooltip };
