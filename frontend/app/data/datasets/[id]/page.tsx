import type { Metadata } from "next";
import { Suspense } from "react";
import { DatasetView } from "@/components/catalog/dataset-view";

export async function generateMetadata({ params }: PageProps<"/data/datasets/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} | Open Forest Observatory` };
}

export default function DatasetPage({ params }: PageProps<"/data/datasets/[id]">) {
  return <Suspense fallback={<p className="p-8">Loading dataset…</p>}>{params.then(({ id }) => <DatasetView id={id} />)}</Suspense>;
}
