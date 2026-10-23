"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Bounds, Dataset } from "@/lib/catalog";
import { EMPTY_FILTERS, filterDatasets, inBounds, type Filters, type KindFilter } from "@/lib/catalog/filters";
import { answer, type Answer, type Apply } from "@/lib/catalog/assistant";

export type ChatMessage = { role: "user"; text: string } | { role: "ai"; answer: Answer };

export interface MapView {
  center: [number, number];
  zoom: number;
}

interface CatalogContext {
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
  const convo = useRef<{ ctx: string[] | null; lastApply: Apply | null }>({ ctx: null, lastApply: null });

  const results = useMemo(
    () => filterDatasets({ filters, query, kind, ids: pick?.ids }),
    [filters, query, kind, pick],
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
    (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setMessages((m) => [...m, { role: "user", text: q }]);
      setBusy(true);
      setDockOpen(true);
      setSheet(null);
      if (pathname !== "/data/catalog") router.push("/data/catalog");
      // Stand-in for the round trip to the FastAPI assistant endpoint.
      setTimeout(() => {
        const a = answer(q, convo.current);
        convo.current = { ctx: a.ctx, lastApply: a.apply ?? convo.current.lastApply };
        // Index of this answer: earlier messages plus the question just added.
        const idx = messages.length + 1;
        setMessages((m) => [...m, { role: "ai", answer: a }]);
        setBusy(false);
        if (a.apply) applyAnswer(a.apply, idx);
      }, 450);
    },
    [busy, messages.length, pathname, router, applyAnswer],
  );

  const value: CatalogContext = {
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
      setMessages([]);
      setAppliedIdx(-1);
      setDockOpen(false);
      setPick(null);
      setFilters(EMPTY_FILTERS);
      setQuery("");
      convo.current = { ctx: null, lastApply: null };
      router.push("/data/assistant");
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
