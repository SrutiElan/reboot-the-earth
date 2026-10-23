"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildCatalog, type Catalog, type Bounds, type Dataset } from "@/lib/catalog";
import { API_BASE, apiJson } from "@/lib/api";
import { EMPTY_FILTERS, filterDatasets, inBounds, type Filters, type KindFilter } from "@/lib/catalog/filters";
import type { Answer, Apply } from "@/lib/catalog/assistant";

export type ChatMessage = { role: "user"; text: string } | { role: "ai"; answer: Answer };

export interface MapView {
  center: [number, number];
  zoom: number;
}

interface CatalogContext {
  catalog: Catalog;
  catalogLoading: boolean;
  catalogError: string | null;
  reloadCatalog: () => void;
  treeCount: number | null;
  progress: string;
  activeAnswer: Answer | null;
  cancelQuery: () => void;
  filters: Filters;
  patchFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  kind: KindFilter;
  setKind: (kind: KindFilter) => void;
  query: string;
  setQuery: (q: string) => void;
  pick: { ids: Set<string>; label: string } | null;
  clearPick: () => void;
  clearAll: () => void;

  /** Datasets matching search and filters, anywhere on the map */
  results: Dataset[];
  /** Results inside the current map bounds */
  visible: Dataset[];
  /** False until the map has reported its bounds */
  mapReady: boolean;
  setBounds: (b: Bounds) => void;
  getMapView: () => MapView | null;
  saveMapView: (view: MapView) => void;
  /** Bumped whenever the map should zoom to fit the results */
  fitToken: number;
  requestFit: () => void;

  hoverId: string | null;
  setHoverId: (id: string | null) => void;

  collection: string[];
  toggleCollection: (id: string) => void;
  sheet: "filters" | "collection" | null;
  setSheet: (s: "filters" | "collection" | null) => void;

  messages: ChatMessage[];
  busy: boolean;
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;
  appliedIdx: number;
  ask: (question: string) => void;
  applyAnswer: (apply: Apply, idx: number) => void;
  newChat: () => void;
}

const Ctx = createContext<CatalogContext | null>(null);

export function useCatalog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCatalog must be used inside CatalogProvider");
  return ctx;
}

// Holds catalog browsing state for every /data page so filters, the collection
// and the assistant conversation survive navigating between them.
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [treeCount, setTreeCount] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [progress, setProgress] = useState("");
  const [activeAnswer, setActiveAnswer] = useState<Answer | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const catalog = useMemo(() => buildCatalog(datasets), [datasets]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<CatalogContext["pick"]>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [collection, setCollection] = useState<string[]>([]);
  const [sheet, setSheet] = useState<CatalogContext["sheet"]>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [appliedIdx, setAppliedIdx] = useState(-1);
  const mapView = useRef<MapView | null>(null);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const convo = useRef<string[]>([]);

  useEffect(() => {
    const abort = new AbortController();
    apiJson<{ datasets: Dataset[]; tree_count: number }>("/api/catalog", { signal: abort.signal })
      .then((body) => {
        setDatasets(body.datasets);
        setTreeCount(body.tree_count);
        setCatalogError(null);
        setFitToken((t) => t + 1);
      })
      .catch((error) => { if (!abort.signal.aborted) setCatalogError(error instanceof Error ? error.message : "Could not load the catalog"); })
      .finally(() => { if (!abort.signal.aborted) setCatalogLoading(false); });
    return () => abort.abort();
  }, [reloadToken]);

  useEffect(() => () => controller.current?.abort(), []);

  const results = useMemo(
    () => filterDatasets(catalog, { filters, query, kind, ids: pick?.ids }),
    [catalog, filters, query, kind, pick],
  );
  const visible = useMemo(() => results.filter((d) => inBounds(d, bounds)), [results, bounds]);

  const requestFit = useCallback(() => setFitToken((t) => t + 1), []);

  const applyAnswer = useCallback(
    (apply: Apply, idx: number) => {
      setFilters({ ...EMPTY_FILTERS, ...apply.filters });
      setPick(apply.ids ? { ids: new Set(apply.ids), label: apply.label ?? "" } : null);
      setQuery(apply.query ?? "");
      setKind("all");
      setAppliedIdx(idx);
      setDockOpen(true);
      requestFit();
      if (pathnameRef.current !== "/data/catalog") router.push("/data/catalog");
    },
    [router, requestFit],
  );

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || inFlight.current) return;
      inFlight.current = true;
      const abort = new AbortController();
      controller.current = abort;
      setMessages((m) => [...m, { role: "user", text: q }]);
      setBusy(true);
      setActiveAnswer(null);
      setProgress("Connecting to the assistant…");
      setDockOpen(true);
      setSheet(null);
      if (pathname !== "/data/catalog") router.push("/data/catalog");
      try {
        const history = messages.slice(-20).map((m) => m.role === "user"
          ? { role: "user", content: m.text }
          : { role: "assistant", content: `${m.answer.text}\nSQL: ${m.answer.sql ?? ""}`.slice(0, 6000) });
        const response = await fetch(`${API_BASE}/api/assistant/query`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
          body: JSON.stringify({ question: q, history, context_ids: convo.current }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(typeof body?.detail === "string" ? body.detail : `Assistant request failed (${response.status})`);
        }
        if (!response.body) throw new Error("No response stream received");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let completed = false;
        const handle = (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line) as { type: string; message?: string; answer?: Answer };
          if (event.type === "status") setProgress(event.message ?? "Working…");
          if (event.type === "error") throw new Error(event.message ?? "Assistant failed");
          if (event.type === "complete" && event.answer) {
            const a = event.answer;
            completed = true;
            convo.current = a.ctx;
            setMessages((m) => [...m, { role: "ai", answer: a }]);
            setActiveAnswer(a.data ? a : null);
            if (a.apply) applyAnswer(a.apply, messages.length + 1);
            else { setPick(null); setFilters(EMPTY_FILTERS); setQuery(""); setKind("all"); }
          }
        };
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handle);
        }
        buffer += decoder.decode();
        handle(buffer);
        if (!completed) throw new Error("The response ended before a result was received. Please retry.");
      } catch (error) {
        if (!abort.signal.aborted) {
          setMessages((m) => [...m, { role: "ai", answer: {
            text: error instanceof Error ? error.message : "The assistant is unavailable", preview: [], apply: null,
            ctx: [], follow: [], data: null, sql: null, attempts: [], status: "failed",
          } }]);
        }
      } finally {
        if (controller.current === abort) {
          inFlight.current = false;
          setBusy(false);
          setProgress("");
          controller.current = null;
        }
      }
    },
    [messages, pathname, router, applyAnswer],
  );

  const value: CatalogContext = {
    catalog, catalogLoading, catalogError, treeCount, progress, activeAnswer,
    reloadCatalog: () => { setCatalogLoading(true); setReloadToken((t) => t + 1); },
    cancelQuery: () => { controller.current?.abort(); },
    filters,
    patchFilters: (patch) => setFilters((f) => ({ ...f, ...patch })),
    clearFilters: () => setFilters(EMPTY_FILTERS),
    kind,
    setKind,
    query,
    setQuery,
    pick,
    clearPick: () => setPick(null),
    clearAll: () => {
      setFilters(EMPTY_FILTERS);
      setPick(null);
      setQuery("");
      setKind("all");
      setActiveAnswer(null);
    },
    results,
    visible,
    mapReady: bounds !== null,
    setBounds,
    getMapView: () => mapView.current,
    saveMapView: (view) => {
      mapView.current = view;
    },
    fitToken,
    requestFit,
    hoverId,
    setHoverId,
    collection,
    toggleCollection: (id) => setCollection((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])),
    sheet,
    setSheet,
    messages,
    busy,
    dockOpen,
    setDockOpen,
    appliedIdx,
    ask,
    applyAnswer,
    newChat: () => {
      controller.current?.abort();
      setMessages([]);
      setAppliedIdx(-1);
      setDockOpen(false);
      setPick(null);
      setFilters(EMPTY_FILTERS);
      setQuery("");
      convo.current = [];
      setActiveAnswer(null);
      router.push("/data/assistant");
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
