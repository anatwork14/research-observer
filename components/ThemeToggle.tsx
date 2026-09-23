"use client";

import { useEffect } from "react";

export function ThemeToggle() {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("research-observer-theme");
    } catch {
      // Browser storage is optional; fall back to the system preference.
    }
    const dark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme !== "dark";
    const theme = next ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("research-observer-theme", theme);
    } catch {
      // The current-page theme still changes when persistence is unavailable.
    }
  }

  return <button className="icon-button" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">◐</button>;
}
