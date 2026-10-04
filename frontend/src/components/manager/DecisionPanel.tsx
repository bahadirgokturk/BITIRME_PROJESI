"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaseDecisions, type AgentDecision } from "@/hooks/useReview";
import { ApiError } from "@/lib/api/client";
import { decisionReasons, decisionTitles } from "@/lib/review";

import { Confidence } from "./Confidence";

function weightText(weight: number | null): string {
  if (weight === null) {
    return "";
  }
  return weight > 0 ? ` +${weight}` : ` ${weight}`;
}

function DecisionRow({ decision }: { decision: AgentDecision }) {
  const titles = decisionTitles(decision);
  return (
    <li className="grid grid-cols-[12rem_1fr_6rem] gap-6 border-t py-3 first:border-t-0">
      <div>
        <p className="text-xs text-muted-foreground">{titles.agent}</p>
        <p className="text-sm font-semibold break-words">{titles.decision}</p>
      </div>
      <div className="space-y-1">
        <ul className="space-y-0.5 text-[13px]">
          {decisionReasons(decision.reasons).map((reason) => (
            <li key={`${reason.code}-${reason.message}`}>
              • {reason.message}
              {weightText(reason.weight)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{decision.model}</p>
      </div>
      <Confidence value={decision.confidence} />
    </li>
  );
}

// AI karar gerekce paneli (docs/UI_GUIDE.md bolum 5.4): her agent icin karar, guven, gerekceler, model
export function DecisionPanel({ caseId }: { caseId: number }) {
  const decisions = useCaseDecisions(caseId, true);
  if (decisions.isPending) {
    return <Skeleton aria-label="Yapay zekâ kararları yükleniyor" className="h-24 w-full" />;
  }
  if (decisions.isError) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 p-3 text-sm">
        <p className="text-destructive">
          Yapay zekâ kararları yüklenemedi.{decisions.error instanceof ApiError ? ` ${decisions.error.message}` : ""}
        </p>
        <Button variant="outline" className="h-11 px-4" onClick={() => void decisions.refetch()}>
          Tekrar dene
        </Button>
      </div>
    );
  }
  if (decisions.data.length === 0) {
    return <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Bu bildirim için yapay zekâ kararı yok.</p>;
  }
  return (
    <ol aria-label="Yapay zekâ kararları" className="rounded-lg bg-muted px-4 py-1">
      {decisions.data.map((decision) => (
        <DecisionRow key={decision.id} decision={decision} />
      ))}
    </ol>
  );
}
