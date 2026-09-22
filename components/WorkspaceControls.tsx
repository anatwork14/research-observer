"use client";

import { useEffect, useState } from "react";

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.isContentEditable;
}

function storedValue(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value === "open" || value === "on";
}

export function WorkspaceControls() {
  const [leftOpen, setLeftOpen] = useState(() => storedValue("research-observer-left-rail", true));
  const [rightOpen, setRightOpen] = useState(() => storedValue("research-observer-right-rail", true));
  const [focus, setFocus] = useState(() => storedValue("research-observer-focus", false));

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.leftRail = leftOpen ? "open" : "closed";
    root.dataset.rightRail = rightOpen ? "open" : "closed";
    root.dataset.focus = focus ? "on" : "off";
    localStorage.setItem("research-observer-left-rail", leftOpen ? "open" : "closed");
    localStorage.setItem("research-observer-right-rail", rightOpen ? "open" : "closed");
    localStorage.setItem("research-observer-focus", focus ? "on" : "off");
  }, [focus, leftOpen, rightOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "[") {
        event.preventDefault();
        setLeftOpen((value) => !value);
      } else if (event.key === "]") {
        event.preventDefault();
        setRightOpen((value) => !value);
      } else if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFocus((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="view-controls" aria-label="Reader layout controls">
      <button onClick={() => setLeftOpen((value) => !value)} aria-pressed={leftOpen} title="Toggle research log ([)">☰</button>
      <button className="focus-toggle" onClick={() => setFocus((value) => !value)} aria-pressed={focus} title="Toggle focus mode (Shift+F)">↔</button>
      <button onClick={() => setRightOpen((value) => !value)} aria-pressed={rightOpen} title="Toggle context rail (])">☷</button>
    </div>
  );
}
