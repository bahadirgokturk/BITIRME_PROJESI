"use client";

import { useEffect } from "react";

// Koyu modda yazdirilan sayfa kagitta siyah zemin olur (murekkep israfi, okunmaz). Yazdirma suresince
// acik temaya gecilir, bitince eski tema geri gelir. Yalniz html sinifi degisir; secim (localStorage) korunur.
export function usePrintLightTheme(): void {
  useEffect(() => {
    const root = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = root.classList.contains("dark");
      root.classList.remove("dark");
    };
    const after = () => {
      root.classList.toggle("dark", wasDark);
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
}
