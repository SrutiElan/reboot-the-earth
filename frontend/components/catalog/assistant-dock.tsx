"use client";

import { HistoryIcon, SquarePenIcon, Trash2Icon, XIcon } from "lucide-react";
import { ASSISTANT_NAME, STARTERS } from "@/lib/catalog/assistant";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCatalog } from "./catalog-provider";
import { ChatInput, ChatThread, FollowUps } from "./chat-thread";

const PLOT_STARTERS = [
  "Is this plot a good ground-truth match for its drone flights?",
  "Which nearby plots measured trees down to a similar size?",
  "Summarize the species and tree sizes on this plot",
];
const MISSION_STARTERS = [
  "Which ground plots could validate this flight?",
  "How does this flight differ from other flights at the same site?",
  "Which plots were surveyed within a year of this flight?",
];

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function HistoryMenu() {
  const { chats, chatId, loadChat, deleteChat } = useCatalog();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Previous chats" disabled={chats.length === 0}>
          <HistoryIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[1200] max-h-[60vh] w-[300px] overflow-y-auto p-1">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Previous chats</DropdownMenuLabel>
        {chats.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => loadChat(c.id)} className={cn("group flex items-center gap-2 px-2 py-2", c.id === chatId && "bg-muted")}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{c.title}</span>
              <span className="block text-xs text-muted-foreground">{ago(c.updatedAt)}</span>
            </span>
            <button
              type="button"
              aria-label={`Delete chat ${c.title}`}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                deleteChat(c.id);
              }}
              className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssistantDock() {
  const { setDockOpen, newChat, messages, ask, busy, focus } = useCatalog();
  const starters = focus ? (focus.id.startsWith("ground-") ? PLOT_STARTERS : MISSION_STARTERS) : STARTERS;

  return (
    <aside
      aria-label={ASSISTANT_NAME}
      className="absolute inset-0 z-[1080] flex flex-col border-l bg-background shadow-[-8px_0_24px_rgba(0,0,0,0.06)] md:relative md:inset-auto md:w-[380px] md:shrink-0 md:shadow-none"
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b px-4 py-3">
        <h2 className="flex-1 text-[15px] font-semibold">Ask {ASSISTANT_NAME}</h2>
        <HistoryMenu />
        <Button variant="outline" size="icon-sm" aria-label="New chat" title="New chat" onClick={newChat} disabled={messages.length === 0}>
          <SquarePenIcon />
        </Button>
        <Button variant="outline" size="icon-sm" className="rounded-full" aria-label="Close" onClick={() => setDockOpen(false)}>
          <XIcon />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2.5">
            <p className="mb-1 text-[13px] leading-[1.6] text-muted-foreground">
              {focus
                ? `I can see the record you're viewing (${focus.id}), including its trust checks and what overlaps it.`
                : "Ask about missions, plots or trees, or tell me to act: filter the catalog, add records to your collection, or open a plot's timeline."}
            </p>
            {starters.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => ask(s)}
                className="rounded-lg border bg-background px-3 py-2.5 text-left text-[13px] leading-snug hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <ChatThread />
      </div>
      <div className="shrink-0 border-t px-4 pt-3 pb-4">
        <FollowUps />
        <ChatInput placeholder="Describe what you need" />
      </div>
    </aside>
  );
}
