"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Assistant replies are Markdown. Raw HTML is not rendered, and links open in a new tab.
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5 text-[13px] leading-[1.6] text-pretty [overflow-wrap:anywhere]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>,
          h1: ({ children }) => <h3 className="pt-1 text-sm font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="pt-1 text-sm font-semibold">{children}</h3>,
          h3: ({ children }) => <h3 className="pt-1 text-[13px] font-semibold">{children}</h3>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 dark:text-drone-ink">
              {children}
            </a>
          ),
          code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{children}</code>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-lg border bg-surface p-3 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>,
          hr: () => <hr className="my-1" />,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b bg-muted/50 px-2.5 py-1.5 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border-b border-border/60 px-2.5 py-1.5 last:border-b-0">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
