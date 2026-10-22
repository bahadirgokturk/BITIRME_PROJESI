// Acik / koyu tema (docs/UI_GUIDE.md bolum 4): renkler globals.css'te :root ve .dark altinda.
// Secim tarayicida saklanir; hic secilmediyse cihazin ayari (prefers-color-scheme) gecerli.
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "bakircayflow-theme";

// PWA'da telefonun durum cubugu uygulamanin zeminiyle ayni renk (globals.css --background)
export const THEME_COLORS: Record<Theme, string> = { light: "#ffffff", dark: "#0a0a0a" };

export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return prefersDark ? "dark" : "light";
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

// Dugmenin ipucu: tiklayinca ne olacagini soyler
export function themeToggleTitle(theme: Theme): string {
  return theme === "dark" ? "Açık moda geç" : "Koyu moda geç";
}

// Sayfa cizilmeden once <head> icinde calisir; yoksa koyu temada acilista bir an beyaz gorunur.
// Gizli sekmede localStorage hata atabilir: o zaman cihaz ayarina gore karar verilir.
export const THEME_INIT_SCRIPT = `(function(){var s=null;try{s=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark")}document.documentElement.style.colorScheme=d?"dark":"light"})();`;
