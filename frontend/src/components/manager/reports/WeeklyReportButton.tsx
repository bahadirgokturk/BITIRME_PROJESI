"use client";

import { FileDownIcon } from "lucide-react";
import { useState } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useDownloadWeeklyReport } from "@/hooks/useAnalytics";
import { recentWeeks } from "@/lib/weeklyReport";

const WEEK_CLASS =
  "flex min-h-11 w-full items-center justify-between rounded-md px-2 text-left text-sm outline-none " +
  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:min-h-9";

// Haftalik yonetici raporu (backend PDF): son tamamlanan haftalardan biri secilir, dosya iner.
// Yazdir ekrandaki donemi basar; bu rapor ise ozet, birimler, tekrar eden sorunlar ve gecikme riskini toplar.
export function WeeklyReportButton() {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const download = useDownloadWeeklyReport();

  function pick(monday: string) {
    setChosen(monday);
    download.mutate(monday, { onSuccess: () => setOpen(false) });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-1.5 px-3 md:h-10 print:hidden")}>
        <FileDownIcon aria-hidden className="size-4" />
        Haftalık rapor (PDF)
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-2 p-2">
        <PopoverTitle className="px-2 pt-1 text-sm font-semibold">Haftalık yönetici raporu</PopoverTitle>
        <p className="px-2 text-[13px] text-muted-foreground">Pazartesi–pazar. Seçilen haftanın raporu PDF olarak iner.</p>
        <ul aria-label="Haftalar">
          {recentWeeks().map((week) => (
            <li key={week.monday}>
              <button type="button" disabled={download.isPending} onClick={() => pick(week.monday)} className={WEEK_CLASS}>
                {week.label}
                {download.isPending && chosen === week.monday ? (
                  <span className="text-xs text-muted-foreground">Hazırlanıyor…</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        <FormAlert error={download.error} />
      </PopoverContent>
    </Popover>
  );
}
