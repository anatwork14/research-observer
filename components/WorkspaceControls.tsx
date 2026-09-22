"use client";

import { useEffect, useSyncExternalStore } from "react";

const UI_EVENT = "research-observer-ui-state";

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.isContentEditable;
}

function subscribe(callback: () => void) {
  window.addEventListener(UI_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(UI_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readToggle(key: string, fallback: boolean) {
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "open" || value === "on";
}

function useStoredToggle(key: string, fallback: boolean) {
  return useSyncExternalStore(
    subscribe,
    () => readToggle(key, fallback),
    () => fallback,
  );
}

function writeToggle(key: string, value: boolean, datasetKey: "leftRail" | "rightRail" | "focus") {
  const encoded = datasetKey === "focus"
    ? (value ? "on" : "off")
    : (value ? "open" : "closed");
  window.localStorage.setItem(key, encoded);
  document.documentElement.dataset[datasetKey] = encoded;
  window.dispatchEvent(new Event(UI_EVENT));
}

export function WorkspaceControls() {
  const leftOpen = useStoredToggle("research-observer-left-rail", true);
  const rightOpen = useStoredToggle("research-observer-right-rail", true);
  const focus = useStoredToggle("research-observer-focus", false);

  function toggleLeft() {
    writeToggle("research-observer-left-rail", !leftOpen, "leftRail");
  }

  function toggleRight() {
    writeToggle("research-observer-right-rail", !rightOpen, "rightRail");
  }

  function toggleFocus() {
    writeToggle("research-observer-focus", !focus, "focus");
  }

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.leftRail = leftOpen ? "open" : "closed";
    root.dataset.rightRail = rightOpen ? "open" : "closed";
    root.dataset.focus = focus ? "on" : "off";
  }, [focus, leftOpen, rightOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "[") {
        event.preventDefault();
        writeToggle("research-observer-left-rail", !leftOpen, "leftRail");
      } else if (event.key === "]") {
        event.preventDefault();
        writeToggle("research-observer-right-rail", !rightOpen, "rightRail");
      } else if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        writeToggle("research-observer-focus", !focus, "focus");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focus, leftOpen, rightOpen]);

  return (
    <div className="view-controls" aria-label="Reader layout controls">
      <button
        onClick={toggleLeft}
        aria-pressed={leftOpen}
        aria-controls="research-sidebar"
        title="Toggle research log ([)"
      >
        ☰
      </button>
      <button
        className="focus-toggle"
        onClick={toggleFocus}
        aria-pressed={focus}
        title="Toggle focus mode (Shift+F)"
      >
        ↔
      </button>
      <button
        onClick={toggleRight}
        aria-pressed={rightOpen}
        aria-controls="research-context-sidebar"
        title="Toggle context rail (])"
      >
        ☷
      </button>
    </div>
  );
}
