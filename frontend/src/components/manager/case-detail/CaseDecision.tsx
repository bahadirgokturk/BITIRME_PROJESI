"use client";

import { useReviewQueue } from "@/hooks/useReview";
import type { CaseRead } from "@/lib/caseList";

import { ReviewActions } from "../ReviewActions";
import { ReviewNotice } from "./CaseSummary";

const TITLE_ID = "case-decision-title";

interface CaseDecisionProps {
  item: CaseRead;
  onDone: (message: string) => void;
}

// Inceleme kuyrugundaki bildirimde karar bu ekrandan da verilir: kuyruktaki kartla ayni dugmeler ve ayni kurallar.
// "Neden burada" ve benzer bildirim kuyruk kaydinda gelir; kayit okunamazsa yalniz kuyruga baglanti gosterilir.
export function CaseDecision({ item, onDone }: CaseDecisionProps) {
  const queue = useReviewQueue();
  const entry = queue.data?.items.find((candidate) => candidate.case.id === item.id);
  if (!entry) {
    return <ReviewNotice />;
  }
  const similar = entry.possible_duplicate_of;
  return (
    <section aria-labelledby={TITLE_ID} className="space-y-3 rounded-lg bg-warning/10 p-4">
      <h2 id={TITLE_ID} className="font-semibold">
        Bu bildirim kararınızı bekliyor
      </h2>
      {entry.reason ? (
        <div>
          <p className="text-xs text-muted-foreground">Neden burada?</p>
          <p className="text-sm">{entry.reason}</p>
        </div>
      ) : null}
      {similar ? (
        <p className="rounded-md bg-card px-3 py-2 text-[13px]">
          Benzer bildirim: {similar.case_number} · {similar.title}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <ReviewActions item={entry} onDone={onDone} />
      </div>
    </section>
  );
}
