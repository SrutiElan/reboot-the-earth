export type SubmissionStatus = "reviewing" | "ready" | "ready_with_cleaning" | "rejected" | "review_error" | "imported";

export interface SubmissionSummary {
  id: string;
  title: string;
  status: SubmissionStatus;
  created_at: string;
}

export interface SubmissionReport extends SubmissionSummary {
  summary: string;
  counts: { plots?: number; trees?: number; missions?: number };
  changes: { operation: string; path: string; before: unknown; after: unknown }[];
  change_count: number;
  cleaning_summary: { operation: string; count: number }[];
  errors: { path: string; message: string }[];
  findings: string[];
  checks: { name: string; status: string }[];
  model: string | null;
  preview: Record<string, Record<string, unknown>[]>;
  review_scope: string;
  imported_at: string | null;
  catalog_ids: string[];
}

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  reviewing: "Reviewing",
  ready: "Ready to import",
  ready_with_cleaning: "Ready after cleaning",
  rejected: "Rejected",
  review_error: "Review unavailable",
  imported: "Imported",
};
