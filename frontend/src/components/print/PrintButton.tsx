"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { periodLabel, type SummaryPeriod } from "@/lib/analytics";
import { formatDateTime } from "@/lib/dates";

// Tarayicinin yazdirma penceresini acar; "PDF olarak kaydet" de oradan secilir (Figma: Button/Outline Yazdir)
export function PrintButton() {
  return (
    <Button variant="outline" className="h-11 gap-1.5 px-3 md:h-10 print:hidden" onClick={() => window.print()}>
      <PrinterIcon aria-hidden className="size-4" />
      Yazdır
    </Button>
  );
}

interface PrintMetaProps {
  period: SummaryPeriod;
  now?: Date;
}

// Yalniz kagitta gorunur: donem secici gizlendigi icin hangi donemin ve ne zaman basildigi yazilir.
// Saat sunucu ve tarayicida birkac saniye farkli olabilir; uyari bastirilir (ekranda zaten gorunmez)
export function PrintMeta({ period, now = new Date() }: PrintMetaProps) {
  return (
    <p suppressHydrationWarning className="hidden text-xs text-muted-foreground print:block">
      {periodLabel(period)} · BakırçayFlow · Yazdırıldı: {formatDateTime(now.toISOString())}
    </p>
  );
}
