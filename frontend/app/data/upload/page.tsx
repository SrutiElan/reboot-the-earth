import type { Metadata } from "next";
import { UploadView } from "@/components/catalog/upload-view";

export const metadata: Metadata = {
  title: "Contribute data | Open Forest Observatory",
  description: "Submit a forest-data JSON package for validation, AI review and import.",
};

export default function UploadPage() {
  return <UploadView />;
}
