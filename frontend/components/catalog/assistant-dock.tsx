"use client";

import { XIcon } from "lucide-react";
import { ASSISTANT_NAME } from "@/lib/catalog/assistant";
import { Button } from "@/components/ui/button";
import { useCatalog } from "./catalog-provider";
import { ChatInput, ChatThread } from "./chat-thread";

export function AssistantDock() {
  const { setDockOpen, newChat } = useCatalog();

  return (
    <aside
      aria-label={ASSISTANT_NAME}
      className="absolute inset-0 z-[1080] flex flex-col border-l bg-background shadow-[-8px_0_24px_rgba(0,0,0,0.06)] md:relative md:inset-auto md:w-[380px] md:shrink-0"
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <h2 className="flex-1 text-[15px] font-semibold">{ASSISTANT_NAME}</h2>
        <Button variant="outline" size="sm" onClick={newChat}>
          New chat
        </Button>
        <Button variant="outline" size="icon-sm" className="rounded-full" aria-label="Close" onClick={() => setDockOpen(false)}>
          <XIcon />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <ChatThread compact />
      </div>
      <div className="shrink-0 border-t px-4 pt-3 pb-4">
        <ChatInput placeholder="Refine or ask a follow-up" />
      </div>
    </aside>
  );
}
