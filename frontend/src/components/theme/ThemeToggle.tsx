"use client";

import { MoonStarIcon, SunIcon } from "lucide-react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { themeToggleTitle } from "@/lib/theme";

// Simge her degisimde yeniden olusur ve donerek buyur; hareket azaltma ayarinda animasyon yok
const ICON_CLASS = "size-5 animate-in spin-in-90 zoom-in-50 duration-300 motion-reduce:animate-none";

// Acik temada gunes, koyu temada ay ve yildiz; tiklayinca simge donerek degisir
// (Figma: 02 Components > ThemeToggle). Durum ekran okuyucuya aria-pressed ile soylenir.
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <Button
      variant="ghost"
      aria-label="Koyu mod"
      aria-pressed={dark}
      title={themeToggleTitle(theme)}
      onClick={toggle}
      className={cn("size-11 shrink-0 md:size-10", className)}
    >
      {dark ? (
        <MoonStarIcon aria-hidden className={ICON_CLASS} />
      ) : (
        <SunIcon aria-hidden className={ICON_CLASS} />
      )}
    </Button>
  );
}
