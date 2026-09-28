"use client";

import { useSyncExternalStore, type ReactNode } from "react";

type Mode = "grid" | "list";
const EVENT = "observaire-collection-view";

function readMode(key: string): Mode {
  try { return window.localStorage.getItem(key) === "list" ? "list" : "grid"; }
  catch { return "grid"; }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function CollectionView({ storageKey, children, label }: { storageKey: string; children: ReactNode; label: string }) {
  const mode = useSyncExternalStore(subscribe, () => readMode(storageKey), () => "grid");
  function setMode(next: Mode) {
    try { window.localStorage.setItem(storageKey, next); } catch { /* View choice remains usable without storage. */ }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div className={`collection-view collection-view-${mode}`}>
      <div className="collection-view-toolbar">
        <span>{label}</span>
        <div role="group" aria-label={`${label} display mode`}>
          <button type="button" aria-label="List view" aria-pressed={mode === "list"} onClick={() => setMode("list")} title="List view">☷</button>
          <button type="button" aria-label="Icon view" aria-pressed={mode === "grid"} onClick={() => setMode("grid")} title="Icon view">▦</button>
        </div>
      </div>
      {children}
    </div>
  );
}
