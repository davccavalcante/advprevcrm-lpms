"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "advprevcrm-theme";
const CHANGE_EVENT = "advprevcrm:themechange";

export type ThemeName = "light" | "dark";

export function readTheme(): ThemeName {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/*
 * Single writer of the theme. The event keeps every control that shows the
 * current theme in agreement, so the bar and the settings screen never disagree
 * about what is applied.
 */
export function applyTheme(next: ThemeName): void {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable, the theme stays for this session only */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useTheme(): {
  theme: ThemeName;
  mounted: boolean;
  setTheme: (next: ThemeName) => void;
} {
  const [theme, setTheme] = useState<ThemeName>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
    const sync = () => setTheme(readTheme());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  return { theme, mounted, setTheme: applyTheme };
}
