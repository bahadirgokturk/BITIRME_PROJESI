"use client";

import { SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSummary } from "@/hooks/useAnalytics";
import type { SummaryPeriod } from "@/lib/analytics";

import { PANEL_CLASS } from "./ChartCard";

function SummaryPanel({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${PANEL_CLASS} relative`}>
      <div className="flex min-h-9 items-center gap-2">
        <SparklesIcon aria-hidden className="size-[18px] text-primary" />
        <h2 className="font-semibold">AI yönetim özeti</h2>
      </div>
      {children}
      {/* Telefonda metnin altinda tam genislik, masaustunde basligin saginda (Figma: AiSummary) */}
      {action ? <div className="md:absolute md:top-5 md:right-5">{action}</div> : null}
    </section>
  );
}

// Bos donemde ozet istenmez: uretilecek bir sey yok
export function AiSummaryEmpty() {
  return (
    <SummaryPanel>
      <p className="text-sm text-muted-foreground">Özet oluşturmak için bu dönemde yeterli bildirim yok.</p>
    </SummaryPanel>
  );
}

// Ozet, gosterilen rakamlardan backend'de uretilir (Analytics Summary Agent); ekran metni degistirmez.
// Ozet hata verirse yalniz bu kutu etkilenir, ekranin geri kalani calismaya devam eder.
export function AiSummary({ period }: { period: SummaryPeriod }) {
  const summary = useSummary(period, true);
  const busy = summary.isFetching;
  const regenerate = (
    <Button variant="outline" className="h-11 w-full md:h-9 md:w-auto" disabled={busy} onClick={() => void summary.refetch()}>
      {busy ? "Oluşturuluyor…" : "Yeniden oluştur"}
    </Button>
  );
  if (summary.isPending) {
    return (
      <SummaryPanel>
        <div aria-label="Özet oluşturuluyor" aria-busy="true" className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </SummaryPanel>
    );
  }
  return (
    <SummaryPanel action={regenerate}>
      {summary.isError ? <FormAlert error={summary.error} /> : <p className="text-sm">{summary.data.text}</p>}
      <p className="text-xs text-muted-foreground">Bu metin gösterilen rakamlardan otomatik üretildi.</p>
    </SummaryPanel>
  );
}
