"use client";

import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaseDecisions, type AgentDecision } from "@/hooks/useReview";
import { ApiError } from "@/lib/api/client";
import { decisionReasons, decisionTitles, weightDetail, type DecisionReason } from "@/lib/review";

import { Confidence } from "./Confidence";

const CHECK_CLASS = "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary";

// Agirliklar ve model adi muduru yormasin diye kapali durur; merak eden acar (Figma: DecisionRow > Ayrintilar)
function DecisionDetails({ reasons, model }: { reasons: DecisionReason[]; model: string }) {
  const weights = reasons.map(weightDetail).filter((text) => text !== null);
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden gap-1 rounded-sm md:min-h-6">
        <span aria-hidden className="transition-transform group-open:rotate-90">
          ▸
        </span>
        Ayrıntılar
      </summary>
      <ul className="space-y-0.5 pb-1 pl-3.5">
        {weights.map((text) => (
          <li key={text}>{text}</li>
        ))}
        <li>Model: {model}</li>
      </ul>
    </details>
  );
}

function DecisionRow({ decision }: { decision: AgentDecision }) {
  const titles = decisionTitles(decision);
  const reasons = decisionReasons(decision.reasons);
  return (
    <li className="grid gap-2 border-t py-3 first:border-t-0 md:grid-cols-[14rem_1fr_6rem] md:gap-6">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={CHECK_CLASS}>
          <CheckIcon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{titles.agent}</p>
          <p className="text-sm font-semibold break-words">{titles.decision}</p>
        </div>
      </div>
      <div className="space-y-1">
        {reasons.length > 0 ? (
          <ul aria-label="Gerekçeler" className="space-y-0.5 text-[13px]">
            {reasons.map((reason) => (
              <li key={`${reason.code}-${reason.message}`}>• {reason.message}</li>
            ))}
          </ul>
        ) : null}
        <DecisionDetails reasons={reasons} model={decision.model} />
      </div>
      <div className="md:justify-self-end">
        <Confidence value={decision.confidence} />
      </div>
    </li>
  );
}

// AI karar gerekce paneli (docs/UI_GUIDE.md bolum 5.4): her agent icin karar, guven, gerekceler, model.
// plain: zaten bir kartin icindeyse (bildirim detayi) gri zemin cizilmez
export function DecisionPanel({ caseId, plain = false }: { caseId: number; plain?: boolean }) {
  const decisions = useCaseDecisions(caseId, true);
  if (decisions.isPending) {
    // Tipik agent hatti 4-6 adim (~300 px): yuklenirken ayni yer tutulur, alttaki zaman cizelgesi kaymaz (CLS)
    return <Skeleton aria-label="Yapay zekâ kararları yükleniyor" className="h-72 w-full" />;
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
    <ol aria-label="Yapay zekâ kararları" className={plain ? "-my-3" : "rounded-lg bg-muted px-4 py-1"}>
      {decisions.data.map((decision) => (
        <DecisionRow key={decision.id} decision={decision} />
      ))}
    </ol>
  );
}
