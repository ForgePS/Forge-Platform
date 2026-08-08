"use client";

import { useEffect, useState } from "react";

export type CreatorThemeMode = "light" | "dark";

const STORAGE_KEY = "forge-creator-theme-mode";

function readStoredMode(): CreatorThemeMode {
  if (typeof window === "undefined") return "light";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "dark" ? "dark" : "light";
}

export function applyCreatorTheme(mode: CreatorThemeMode): void {
  const root = document.documentElement;
  root.setAttribute("data-bs-theme", mode);
  root.setAttribute("data-theme", "theme-default");
  root.classList.toggle("light-style", mode === "light");
  root.classList.toggle("dark-style", mode === "dark");
  root.classList.add("layout-menu-fixed");
  root.style.colorScheme = mode;
}

export function ThemeModeToggle() {
  const [mode, setMode] = useState<CreatorThemeMode>("light");

  useEffect(() => {
    const initial = readStoredMode();
    setMode(initial);
    applyCreatorTheme(initial);
  }, []);

  function toggle() {
    const next: CreatorThemeMode = mode === "light" ? "dark" : "light";
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyCreatorTheme(next);
  }

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      className="btn btn-sm btn-icon btn-outline-secondary"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      onClick={toggle}
    >
      <i className={`bx ${isDark ? "bx-sun" : "bx-moon"} bx-sm`} aria-hidden="true" />
    </button>
  );
}
