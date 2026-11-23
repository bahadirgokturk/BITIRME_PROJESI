"use client";

import { UsersIcon } from "lucide-react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import type { SimilarOpenCase } from "@/hooks/useSimilarCases";
import { relativeTime } from "@/lib/dates";

const TITLE_ID = "similar-notice-title";

interface SimilarNoticeProps {
  items: SimilarOpenCase[];
  pending: boolean;
  error: Error | null;
  onSupport: (caseId: number) => void;
}

// Bildirmeden once: ayni yerde acik, benzer bildirim varsa gosterilir (Duplicate Agent form aninda).
// Baskasinin metni gosterilmez; yalniz tur, yer, ne zaman ve kac kisi. Farkli bir sorunsa form normal gonderilir
export function SimilarNotice({ items, pending, error, onSupport }: SimilarNoticeProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={TITLE_ID} className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <div className="space-y-1">
        <h2 id={TITLE_ID} className="font-semibold">
          Bu sorun zaten bildirilmiş olabilir
        </h2>
        <p className="text-sm text-muted-foreground">
          Aynı sorunu yaşıyorsan destekle: kaydın bu bildirime bağlanır, çözülünce sana da haber veririz.
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.case_id} className="flex flex-col gap-2 rounded-md bg-background p-3 md:flex-row md:items-center">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                {item.case_type_name} · {item.location_name}
              </p>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <UsersIcon aria-hidden className="size-3.5" />
                {item.supporters} kişi bildirdi · {relativeTime(item.created_at)}
              </p>
            </div>
            <Button type="button" className="h-11 md:h-9" disabled={pending} onClick={() => onSupport(item.case_id)}>
              Ben de yaşıyorum, destekle
            </Button>
          </li>
        ))}
      </ul>
      <FormAlert error={error} />
      <p className="text-xs text-muted-foreground">Farklı bir sorunsa aşağıdan göndermeye devam et.</p>
    </section>
  );
}
