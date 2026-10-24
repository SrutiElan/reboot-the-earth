"use client";

import { usePathname, useRouter } from "next/navigation";
import { BookmarkIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSISTANT_NAME, hasAssistantPanel } from "@/lib/catalog/assistant";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";

// Opens the collection and the assistant.
export function CatalogSwitcher() {
  const { dockOpen, setDockOpen, collection, setSheet } = useCatalog();
  const pathname = usePathname();
  const router = useRouter();
  const panelShowing = dockOpen && hasAssistantPanel(pathname);

  // The assistant is a panel beside the catalog; from other pages, go to the catalog with it open.
  const openAssistant = () => {
    setDockOpen(true);
    if (!hasAssistantPanel(pathname)) router.push("/data/catalog");
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="h-9 gap-2 pr-2.5 pl-3" onClick={() => setSheet("collection")}>
        <BookmarkIcon className="size-[15px]" aria-hidden />
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
      {!panelShowing && (
        <Button variant="outline" onClick={openAssistant} className="h-9 gap-2 px-3">
          <SparklesIcon className="size-[15px] text-primary dark:text-drone-ink" />
          Ask {ASSISTANT_NAME}
        </Button>
      )}
    </div>
  );
}
