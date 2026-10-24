import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "stored-list-change";

/** A list of strings kept in localStorage, safe on the server and when storage is blocked. */
export function useStoredList(key: string, max: number) {
  const read = () => {
    try {
      return localStorage.getItem(key) ?? "[]";
    } catch {
      return "[]";
    }
  };
  const raw = useSyncExternalStore(
    (notify) => {
      window.addEventListener(EVENT, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(EVENT, notify);
        window.removeEventListener("storage", notify);
      };
    },
    read,
    () => "[]",
  );
  const list = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [raw]);

  const write = useCallback(
    (next: string[]) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return {
    list,
    add: (item: string) => write([item, ...list.filter((x) => x.toLowerCase() !== item.toLowerCase())].slice(0, max)),
    remove: (item: string) => write(list.filter((x) => x !== item)),
    clear: () => write([]),
  };
}
