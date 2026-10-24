"use client";

import { BellIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useWaitingCases } from "@/hooks/useCases";
import { actionNeeded, type WaitingCase } from "@/lib/caseActions";

// Yanit bekleyen varsa acik turuncu, yoksa acik gri (Figma: WaitingBell, Durum=Bekleyen var / Yok).
// Pencere acikken de ayni renk kalir (ghost dugmenin aria-expanded grisi ezilir)
const TONE = {
  waiting:
    "bg-warning/15 text-warning hover:bg-warning/25 hover:text-warning aria-expanded:bg-warning/25 aria-expanded:text-warning",
  idle: "bg-muted hover:bg-muted/80",
} as const;

function WaitingList({ waiting, onPick }: { waiting: WaitingCase[]; onPick: () => void }) {
  return (
    <ul className="max-h-90 overflow-y-auto">
      {waiting.map(({ item, reason }) => (
        <li key={item.id}>
          <Link
            href={`/cases/${item.id}`}
            onClick={onPick}
            className="flex min-h-11 items-center gap-2 rounded-md px-2 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{reason}</span>
            </span>
            <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Bildirim zili: telefonda ust cubukta tema dugmesinin solunda, masaustunde Bildirimlerim'de "Bildirim yap"in
// solunda. Tiklayinca telefon bildirimi gibi pencere acilir; bildirime tiklayinca o bildirim acilir.
// Liste kurali lib/caseActions.ts actionNeeded (ek bilgi istenenler, 72 saat icinde puan bekleyenler).
export function WaitingBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const query = useWaitingCases();
  const waiting = query.data ? actionNeeded(query.data) : [];
  const has = waiting.length > 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={has ? `Bildirimler: ${waiting.length} yanıt bekliyor` : "Bildirimler: yanıt bekleyen yok"}
        data-waiting={has}
        className={cn(buttonVariants({ variant: "ghost" }), "size-11 shrink-0 md:size-10", TONE[has ? "waiting" : "idle"], className)}
      >
        <BellIcon aria-hidden className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-24px)] gap-1 p-2">
        <PopoverTitle className="px-2 pt-1 text-sm font-semibold">
          {has ? `Sizden yanıt bekleniyor (${waiting.length})` : "Bildirimler"}
        </PopoverTitle>
        {has ? (
          <WaitingList waiting={waiting} onPick={() => setOpen(false)} />
        ) : (
          <p className="px-2 pb-1.5 text-[13px] text-muted-foreground">Şu an sizden yanıt bekleyen bildirim yok.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
