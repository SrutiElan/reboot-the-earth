"use client";

import { usePathname, useRouter } from "next/navigation";
import { SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSISTANT_NAME } from "@/lib/catalog/assistant";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";

// Opens the assistant and the collection.
export function CatalogSwitcher() {
  const { messages, dockOpen, setDockOpen, collection, setSheet } = useCatalog();
  const pathname = usePathname();
  const router = useRouter();
  const onCatalog = pathname === "/data/catalog";
  const onAssistant = pathname === "/data/assistant";
  const aiActive = onCatalog && dockOpen;

  // Before the first question, open the assistant page. After that, the
  // conversation lives in the dock beside the catalog.
  const openAssistant = () => {
    if (!messages.length) return router.push("/data/assistant");
    if (onCatalog) return setDockOpen(!dockOpen);
    setDockOpen(true);
    router.push("/data/catalog");
  };

  return (
    <div className="flex items-center gap-2">
      {!onAssistant && (
        <Button
          variant="outline"
          aria-pressed={aiActive}
          onClick={openAssistant}
          className={cn(
            "h-9 gap-2 px-3",
            aiActive && "border-primary/40 bg-selected text-primary hover:bg-selected dark:text-drone-ink",
          )}
        >
          <SparklesIcon className="size-[15px] text-primary dark:text-drone-ink" />
          Ask {ASSISTANT_NAME}
        </Button>
      )}
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
