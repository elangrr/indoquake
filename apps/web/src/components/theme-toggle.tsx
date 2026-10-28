"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, currentTheme, type ThemeChoice } from "@/lib/theme";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("indoquake:theme", onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("indoquake:theme", onChange);
    media.removeEventListener("change", onChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<ThemeChoice | null>(subscribe, currentTheme, () => null);
  const next: ThemeChoice = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={next === "dark" ? "Pakai tema gelap" : "Pakai tema terang"}
      className="flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
      </svg>
    </button>
  );
}
