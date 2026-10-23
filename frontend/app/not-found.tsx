import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-5 py-24">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">This page isn&apos;t part of the prototype</h1>
      <p className="max-w-[60ch] text-muted-foreground">
        The prototype covers the Data section of the site. Tools, Get Involved and About live on the current
        openforestobservatory.org.
      </p>
      <Link href="/data" className="font-medium text-primary underline underline-offset-[3px] dark:text-drone-ink">
        Go to Forest Data
      </Link>
    </div>
  );
}
