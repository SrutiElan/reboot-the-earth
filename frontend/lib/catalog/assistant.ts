import type { Filters } from "./filters";

export const ASSISTANT_NAME = "AI";
export interface Apply {
  filters?: Partial<Filters>;
  ids?: string[];
  query?: string;
  label?: string;
}
export interface QueryData {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
  elapsed_ms: number;
}
export interface Attempt {
  attempt: number;
  sql: string;
  error?: string;
  feedback?: string;
  row_count?: number;
  decision?: string;
}
/** Actions the assistant performed for the user; the server validates every id. */
export type AssistantAction =
  | { type: "add_to_collection"; ids: string[] }
  | { type: "set_filters"; filters: Partial<Filters> }
  | { type: "open_dataset"; dataset_id: string };

export interface Answer {
  text: string;
  preview: string[];
  apply: Apply | null;
  actions: AssistantAction[];
  /** Ids this answer newly added to the collection (client side, enables undo). */
  added?: string[];
  undone?: boolean;
  /** Filters proposed by the assistant wait here until the user confirms or dismisses them. */
  pending?: boolean;
  dismissed?: boolean;
  ctx: string[];
  follow: string[];
  data: QueryData | null;
  sql: string | null;
  attempts: Attempt[];
  model?: string;
  status: "usable" | "empty" | "failed" | "clarification";
}
export const STARTERS = [
  "Which drone missions overlap ground plots?",
  "Put every plot that includes snags and measures trees down to 5 cm in my collection",
  "Show plots covered by drone flights on three or more different dates",
  "Open the most recently surveyed plot",
];
