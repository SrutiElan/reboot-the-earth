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
export interface Answer {
  text: string;
  preview: string[];
  apply: Apply | null;
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
  "What's the most recently surveyed plot?",
  "Nadir flights since 2024 with a Mavic aircraft",
  "统计每个项目的树木数量、平均树高和物种数量",
];
