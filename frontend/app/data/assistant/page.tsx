import type { Metadata } from "next";
import { AssistantView } from "@/components/catalog/assistant-view";

export const metadata: Metadata = { title: "Ask the catalog | Open Forest Observatory" };

export default function AssistantPage() {
  return <AssistantView />;
}
