"use client";

import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { useCatalog } from "@/components/catalog/catalog-provider";
import { ASSISTANT_NAME } from "@/lib/catalog/assistant";
import { Button } from "@/components/ui/button";
import { KindMark } from "@/components/catalog/kind-mark";

const link = "font-medium text-primary underline underline-offset-[3px] hover:text-primary-hover dark:text-drone-ink";

export default function DataLanding() {
  const { catalog, catalogLoading, catalogError, reloadCatalog, treeCount } = useCatalog();
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-16 px-5 pt-16 pb-24">
      <section className="grid items-center gap-10 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <div className="flex flex-col gap-5">
          <h1 className="text-[clamp(40px,6vw,56px)] leading-[1.05] font-semibold tracking-[-0.03em]">Forest Data</h1>
          <p className="max-w-[30rem] text-lg leading-relaxed text-pretty text-muted-foreground">
            Drone-based forest mapping data, traditional field-based reference data, and guidance for new data
            collection.
          </p>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground tabular-nums">
            <span className="flex items-center gap-2">
              <KindMark kind="drone" />
              {catalogLoading ? "Loading…" : `${catalog.missions.length} drone missions`}
            </span>
            <span className="flex items-center gap-2">
              <KindMark kind="ground" />
              {catalogLoading ? "Loading…" : `${catalog.plots.length} ground plots`}
            </span>
            <span>{catalogLoading ? "Loading…" : `${catalog.siteNames.length} projects`}</span>
            {treeCount !== null && <span>{treeCount.toLocaleString()} tree records</span>}
          </p>
          {catalogError && <p role="alert" className="text-sm text-red-700">{catalogError} <button type="button" onClick={reloadCatalog} className="underline">Retry</button></p>}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <Button asChild className="h-11 px-[22px] text-[15px] hover:bg-primary-hover">
              <Link href="/data/catalog">View data</Link>
            </Button>
            {/* <Button asChild variant="outline" className="h-11 gap-2 px-[22px] text-[15px]">
              <Link href="/data/catalog?ai=1">
                <SparklesIcon className="size-4 text-primary dark:text-drone-ink" />
                Ask {ASSISTANT_NAME}
              </Link>
            </Button> */}
            <Button asChild variant="outline" className="h-11 px-[22px] text-[15px]">
              <Link href="/data/sql">SQL console</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-[22px] text-[15px]">
              <Link href="/data/upload">Contribute data</Link>
            </Button>
          </div>
        </div>
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://openforestobservatory.org/media/tree-points.png"
            alt="Individual tree detections plotted over a drone orthomosaic"
            className="aspect-[4/3] w-full rounded-xl border bg-surface object-cover"
          />
          <figcaption className="text-[13px] text-muted-foreground">
            Individual tree detections over a drone orthomosaic.
          </figcaption>
        </figure>
      </section>

      <section className="grid gap-x-10 gap-y-10 border-t pt-10 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">
            <KindMark kind="drone" className="size-2.5" />
            Drone-based data
          </h2>
          <p className="text-sm leading-[1.7] text-pretty text-muted-foreground">
            Browse {catalog.missions.length || "the imported"} drone mission records with real collection metadata,
            footprint boundaries and spatial links to ground plots in our{" "}
            <Link href="/data/catalog?kind=drone" className={link}>
              html map
            </Link>{" "}
            or through our{" "}
            <a href="https://radiantearth.github.io/stac-browser/#/external/stac.cyverse.org/" className={link}>
              SpatioTemporal Asset Catalog (STAC)
            </a>
            .
          </p>
          <p className="text-sm leading-[1.7] text-muted-foreground">
            The data can also be accessed programmatically with python. Learn how{" "}
            <a
              href="https://github.com/open-forest-observatory/stac?tab=readme-ov-file#access-ofo-data-with-python"
              className={link}
            >
              here
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">
            <KindMark kind="ground" className="size-2.5" />
            Ground reference data
          </h2>
          <p className="text-sm leading-[1.7] text-pretty text-muted-foreground">
            Explore {catalog.plots.length || "the imported"} ground inventory plots and {treeCount?.toLocaleString() ?? "their"} tree records,
            including measured heights, species and stem locations. Download actual records or ask AI to query them.{" "}
            <Link href="/data/catalog?kind=ground" className={link}>
              Access the catalog.
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Data collection protocols</h2>
          <p className="text-sm leading-[1.7] text-pretty text-muted-foreground">
            We have detailed protocols for collecting the drone and field data. Check out our methods and get guidance
            for collecting (and, we hope, contributing!) your own drone and field-based forest data.
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li>
              <a href="https://openforestobservatory.org/workflows/data-collection/drone/" className={link}>
                Drone data collection protocol
              </a>
            </li>
            <li>
              <a href="https://openforestobservatory.org/workflows/data-collection/ground-reference/" className={link}>
                Ground reference data collection protocol
              </a>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
