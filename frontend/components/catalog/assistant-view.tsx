"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { ASSISTANT_NAME, STARTERS } from "@/lib/catalog/assistant";
import { useCatalog } from "./catalog-provider";
import { ChatInput } from "./chat-thread";
import { CatalogSwitcher } from "./catalog-switcher";

export function AssistantView() {
  const { ask } = useCatalog();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
        <nav aria-label="Breadcrumb" className="flex flex-1 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/data" className="text-foreground hover:underline">
            Data
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden />
          <Link href="/data/catalog" className="text-foreground hover:underline">
            All datasets
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden />
          <span aria-current="page">Ask {ASSISTANT_NAME}</span>
        </nav>
        <CatalogSwitcher />
      </div>
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center gap-8 px-5 pt-10 pb-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-[clamp(26px,4vw,32px)] leading-tight font-semibold tracking-[-0.02em]">
            What are you looking for?
          </h1>
          <p className="max-w-[60ch] text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Ask about missions, plots or individual trees. I&apos;ll query the database, check the results and show
            the returned data alongside the map.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <ChatInput large autoFocus placeholder="e.g. nadir flights over ground plots since 2023" />
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="min-h-[34px] rounded-full border bg-background px-3.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
