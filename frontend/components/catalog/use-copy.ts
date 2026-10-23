"use client";

import { useEffect, useRef, useState } from "react";

/** Copies text and remembers which key was copied for ~1.6s, for "Copied" labels. */
export function useCopy() {
  const [copied, setCopied] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(""), 1600);
  };

  return [copied, copy] as const;
}
