import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-5 py-24">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Page not found</h1>
      <p className="max-w-[60ch] text-muted-foreground">
        This address does not exist. Browse the live catalog or ask the assistant to find data.
      </p>
      <Link href="/data" className="font-medium text-primary underline underline-offset-[3px] dark:text-drone-ink">
        Go to Forest Data
      </Link>
    </div>
  );
}
