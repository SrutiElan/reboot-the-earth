import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { DatasetView } from "@/components/catalog/dataset-view";

export function generateStaticParams() {
  return catalog.all.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/data/datasets/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `${catalog.byId(id)?.name ?? "Dataset"} | Open Forest Observatory` };
}

function Dataset({ id }: { id: string }) {
  if (!catalog.byId(id)) notFound();
  return <DatasetView id={id} />;
}

export default function DatasetPage({ params }: PageProps<"/data/datasets/[id]">) {
  return <Suspense>{params.then(({ id }) => <Dataset id={id} />)}</Suspense>;
}
