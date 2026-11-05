"use client";

import { useSyncExternalStore } from "react";

import { THEME_COLORS, THEME_STORAGE_KEY, nextTheme, type Theme } from "@/lib/theme";

// Tema <html> etiketindeki "dark" sinifidir; sayfadaki butun dugmeler ayni kaynaktan okur
const CHANGE_EVENT = "bakircayflow-theme-change";

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function remember(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // Gizli sekme ya da engellenmis site verisi: tema bu oturumda gecerli kalir, yalniz hatirlanmaz
    if (!(error instanceof DOMException)) {
      throw error;
    }
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  remember(theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTheme() {
  // Sunucuda tema bilinmez: acik varsayilir, tarayicida gercek deger okunur
  const theme = useSyncExternalStore(subscribe, currentTheme, (): Theme => "light");
  return { theme, toggle: () => apply(nextTheme(theme)) };
}
