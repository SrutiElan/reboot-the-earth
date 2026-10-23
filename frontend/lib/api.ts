export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function datasetFileUrl(id: string, filename: string) {
  return `${API_BASE}/api/catalog/datasets/${encodeURIComponent(id)}/files/${filename}`;
}

export function downloadRows(rows: Record<string, unknown>[], columns: string[], filename: string) {
  const quote = (v: unknown) => `"${(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll('"', '""')}"`;
  const csv = [columns.map(quote).join(","), ...rows.map((r) => columns.map((c) => quote(r[c])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
