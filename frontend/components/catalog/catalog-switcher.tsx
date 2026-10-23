"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ASSISTANT_NAME } from "@/lib/catalog/assistant";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";

// Switches between browsing and the assistant, and opens the collection.
export function CatalogSwitcher() {
  const { messages, dockOpen, setDockOpen, collection, setSheet } = useCatalog();
  const pathname = usePathname();
  const router = useRouter();
  const onCatalog = pathname === "/data/catalog";
  const dataActive = onCatalog || pathname.startsWith("/data/datasets");
  const aiActive = pathname === "/data/assistant" || (onCatalog && dockOpen);

  const openAssistant = () => {
    if (!messages.length) return router.push("/data/assistant");
    if (onCatalog) return setDockOpen(!dockOpen);
    setDockOpen(true);
    router.push("/data/catalog");
  };

  const segment = (active: boolean) =>
    cn(
      "h-full rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      active ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.1)] dark:bg-card" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 grid-cols-2 rounded-lg bg-muted p-[3px]">
        <button type="button" aria-pressed={dataActive} className={segment(dataActive)} onClick={() => router.push("/data/catalog")}>
          Data
        </button>
        <button type="button" aria-pressed={aiActive} className={segment(aiActive)} onClick={openAssistant}>
          {ASSISTANT_NAME}
        </button>
      </div>
      <Button variant="outline" className="h-9 gap-2 pr-2.5 pl-3" onClick={() => setSheet("collection")}>
        Collection
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs text-white tabular-nums",
            collection.length ? "bg-primary" : "bg-muted-foreground/60",
          )}
        >
          {collection.length}
        </span>
      </Button>
    </div>
  );
}
