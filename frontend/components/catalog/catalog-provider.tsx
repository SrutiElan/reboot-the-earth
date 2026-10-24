"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildCatalog, type Catalog, type Bounds, type Dataset } from "@/lib/catalog";
import { API_BASE, apiJson } from "@/lib/api";
import { EMPTY_FILTERS, filterDatasets, inBounds, type Filters, type KindFilter } from "@/lib/catalog/filters";
import { hasAssistantPanel, type Answer, type Apply } from "@/lib/catalog/assistant";

export type ChatMessage = { role: "user"; text: string } | { role: "ai"; answer: Answer };

export interface SavedChat {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const CHATS_KEY = "ofo.chats.v1";
const MAX_CHATS = 30;
const MAX_SAVED_ROWS = 50;

/** Saved chats keep the conversation but not the full result tables or retry traces. */
function slimMessage(m: ChatMessage): ChatMessage {
  if (m.role === "user") return m;
  const { data } = m.answer;
  return {
    role: "ai",
    answer: {
      ...m.answer,
      attempts: [],
      pending: false,
      data: data && { ...data, rows: data.rows.slice(0, MAX_SAVED_ROWS), truncated: data.truncated || data.rows.length > MAX_SAVED_ROWS },
    },
  };
}

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
  /** Move the map to a box (a searched place) without filtering the catalog. */
  flyTarget: { bounds: Bounds; token: number } | null;
  flyTo: (bounds: Bounds) => void;

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
  /** The record whose page is open, so the assistant can answer "this plot" questions. */
  focus: { id: string; text: string } | null;
  setFocus: (focus: { id: string; text: string } | null) => void;
  appliedIdx: number;
  ask: (question: string) => void;
  applyAnswer: (apply: Apply, idx: number) => void;
  /** Run the actions an answer proposed (filters need this confirmation first). */
  confirmAnswer: (messageIdx: number) => void;
  dismissAnswer: (messageIdx: number) => void;
  chats: SavedChat[];
  chatId: string | null;
  loadChat: (id: string) => void;
  deleteChat: (id: string) => void;
  newChat: () => void;
  /** Remove what an assistant answer added to the collection. */
  undoAdd: (messageIdx: number) => void;
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
  const [flyTarget, setFlyTarget] = useState<{ bounds: Bounds; token: number } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [collection, setCollection] = useState<string[]>([]);
  const [sheet, setSheet] = useState<CatalogContext["sheet"]>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [focus, setFocus] = useState<{ id: string; text: string } | null>(null);
  const [appliedIdx, setAppliedIdx] = useState(-1);
  const mapView = useRef<MapView | null>(null);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const convo = useRef<string[]>([]);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const collectionRef = useRef<string[]>([]);
  useEffect(() => {
    collectionRef.current = collection;
  }, [collection]);

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

  // Chat history lives in this browser only.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHATS_KEY) ?? "[]");
      if (Array.isArray(saved)) setChats(saved);
    } catch {}
    setChatsLoaded(true);
  }, []);
  useEffect(() => {
    if (!chatsLoaded) return;
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    } catch {}
  }, [chats, chatsLoaded]);
  useEffect(() => {
    if (!messages.length || !chatId) return;
    const title = (messages.find((m) => m.role === "user") as { text: string } | undefined)?.text.slice(0, 60) ?? "Chat";
    const saved: SavedChat = { id: chatId, title, updatedAt: Date.now(), messages: messages.map(slimMessage) };
    setChats((all) => [saved, ...all.filter((c) => c.id !== chatId)].slice(0, MAX_CHATS));
  }, [messages, chatId]);

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

  /** Perform an answer's actions and mark which records it added to the collection. */
  const onCatalogPage = () => pathnameRef.current === "/data/catalog";

  const runAnswer = useCallback(
    (a: Answer, idx: number): Answer => {
      const adds = a.actions.flatMap((x) => (x.type === "add_to_collection" ? x.ids : []));
      let done = a;
      if (adds.length) {
        const have = new Set(collectionRef.current);
        const added = [...new Set(adds)].filter((id) => !have.has(id));
        done = { ...a, added };
        setCollection((c) => [...c, ...added]);
        setMessages((all) => all.map((m, i) => (i === idx && m.role === "ai" ? { role: "ai", answer: done } : m)));
      }
      const open = a.actions.find((x) => x.type === "open_dataset");
      if (open) {
        setDockOpen(true);
        router.push(`/data/datasets/${open.dataset_id}#timeline`);
      } else if (!onCatalogPage()) {
        // On a record page the answer stays in the panel; "Show on the map" is the user's call.
      } else if (a.apply) applyAnswer(a.apply, idx);
      else {
        setPick(null);
        setFilters(EMPTY_FILTERS);
        setQuery("");
        setKind("all");
      }
      return done;
    },
    [router, applyAnswer],
  );

  const resolveAnswer = useCallback(
    (idx: number, accept: boolean) => {
      const m = messages[idx];
      if (m?.role !== "ai" || !m.answer.pending) return;
      const base = { ...m.answer, pending: false, dismissed: !accept };
      setMessages((all) => all.map((x, i) => (i === idx ? { role: "ai", answer: base } : x)));
      if (accept) runAnswer(base, idx);
    },
    [messages, runAnswer],
  );

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || inFlight.current) return;
      inFlight.current = true;
      const abort = new AbortController();
      controller.current = abort;
      setChatId((id) => id ?? crypto.randomUUID());
      setMessages((m) => [...m, { role: "user", text: q }]);
      setBusy(true);
      setActiveAnswer(null);
      setProgress("Connecting to the assistant…");
      setDockOpen(true);
      setSheet(null);
      if (!hasAssistantPanel(pathname)) router.push("/data/catalog");
      try {
        const history = messages.slice(-20).map((m) => m.role === "user"
          ? { role: "user", content: m.text }
          : { role: "assistant", content: `${m.answer.text}\nSQL: ${m.answer.sql ?? ""}`.slice(0, 6000) });
        const response = await fetch(`${API_BASE}/api/assistant/query`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
          body: JSON.stringify({ question: q, history, context_ids: focus ? [focus.id, ...convo.current].slice(0, 50) : convo.current, focus: focus?.text ?? "" }),
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
            a.actions ??= [];
            const idx = messages.length + 1;
            // Filters change what the user is looking at, so they wait for a confirmation.
            const needsConfirm = a.actions.some((x) => x.type === "set_filters");
            const shown = needsConfirm ? { ...a, pending: true } : a;
            setMessages((m) => [...m, { role: "ai", answer: shown }]);
            setActiveAnswer(a.data ? shown : null);
            if (!needsConfirm) runAnswer(a, idx);
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
            text: error instanceof Error ? error.message : "The assistant is unavailable", preview: [], apply: null, actions: [],
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
    [messages, pathname, router, runAnswer, focus],
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
    flyTarget,
    flyTo: (bounds) => setFlyTarget((t) => ({ bounds, token: (t?.token ?? 0) + 1 })),
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
    focus,
    setFocus,
    appliedIdx,
    ask,
    applyAnswer,
    undoAdd: (messageIdx) => {
      const message = messages[messageIdx];
      if (message?.role !== "ai" || !message.answer.added?.length) return;
      const remove = new Set(message.answer.added);
      setCollection((c) => c.filter((id) => !remove.has(id)));
      setMessages((all) => all.map((m, i) => (i === messageIdx && m.role === "ai" ? { role: "ai", answer: { ...m.answer, added: [], undone: true } } : m)));
    },
    confirmAnswer: (idx) => resolveAnswer(idx, true),
    dismissAnswer: (idx) => resolveAnswer(idx, false),
    chats,
    chatId,
    loadChat: (id) => {
      const chat = chats.find((c) => c.id === id);
      if (!chat) return;
      controller.current?.abort();
      inFlight.current = false;
      setBusy(false);
      setProgress("");
      setMessages(chat.messages);
      setChatId(id);
      setAppliedIdx(-1);
      setActiveAnswer(null);
      const last = chat.messages.findLast((m) => m.role === "ai");
      convo.current = last?.role === "ai" ? last.answer.ctx : [];
      setDockOpen(true);
    },
    deleteChat: (id) => {
      setChats((all) => all.filter((c) => c.id !== id));
      if (id === chatId) {
        setMessages([]);
        setChatId(null);
        convo.current = [];
        setActiveAnswer(null);
      }
    },
    // Starts a fresh conversation in the same panel; no page change.
    newChat: () => {
      controller.current?.abort();
      inFlight.current = false;
      setBusy(false);
      setProgress("");
      setMessages([]);
      setChatId(null);
      setAppliedIdx(-1);
      convo.current = [];
      setActiveAnswer(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
