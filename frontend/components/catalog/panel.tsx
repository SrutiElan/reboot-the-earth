import { cn } from "@/lib/utils";

/** A titled box. `bare` drops the box and title for content that already sits inside another panel. */
export function Panel({ title, action, children, className, bare }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; bare?: boolean }) {
  if (bare) {
    return (
      <div className={className}>
        {action && <div className="flex justify-end px-5 pt-3">{action}</div>}
        {children}
      </div>
    );
  }
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="flex min-h-[52px] items-center gap-3 border-b px-5 py-2.5">
        <h2 className="flex-1 text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
