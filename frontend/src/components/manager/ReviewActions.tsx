"use client";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { useReviewAction, type ReviewItem } from "@/hooks/useReview";
import type { components } from "@/lib/api/types";
import { reviewActions } from "@/lib/review";

import { OverrideDialog } from "./OverrideDialog";
import { ReasonDialog } from "./ReasonDialog";

type Schemas = components["schemas"];

interface ActionProps {
  item: ReviewItem;
  onDone: (message: string) => void;
}

// Onay = AI'in onerdigi birime atama (backend/app/services/review_service.py)
function ApproveButton({ item, onDone }: ActionProps) {
  const assign = useReviewAction<Schemas["AssignRequest"]>(item.case.id, "assign");
  const departmentId = item.case.department?.id;
  return (
    <>
      <Button
        className="h-11 px-4"
        disabled={departmentId === undefined || assign.isPending}
        onClick={() =>
          departmentId !== undefined &&
          assign.mutate({ department_id: departmentId }, { onSuccess: () => onDone(`${item.case.case_number} atandı.`) })
        }
      >
        {assign.isPending ? "Atanıyor…" : "Onayla ve ata"}
      </Button>
      {assign.error ? <FormAlert error={assign.error} /> : null}
    </>
  );
}

function SimpleReasonAction({ item, onDone, kind }: ActionProps & { kind: "reject" | "merge" | "close" }) {
  const action = useReviewAction<{ reason: string; parent_case_id?: number }>(item.case.id, kind);
  const parent = item.possible_duplicate_of;
  const texts = {
    reject: { label: "Reddet", description: "Bildirim reddedilir ve kuyruktan çıkar.", done: "reddedildi" },
    merge: { label: "Birleştir", description: `Bu bildirim ${parent?.case_number} · ${parent?.title} ile birleştirilir.`, done: "birleştirildi" },
    close: { label: "Kapat", description: "Tamamlanan iş doğrulanır ve bildirim kapatılır.", done: "kapatıldı" },
  }[kind];
  return (
    <ReasonDialog
      trigger={texts.label}
      title={`${texts.label}: ${item.case.case_number}`}
      description={texts.description}
      confirm={texts.label}
      mutation={action}
      toBody={(reason) => (kind === "merge" && parent ? { parent_case_id: parent.id, reason } : { reason })}
      onDone={() => onDone(`${item.case.case_number} ${texts.done}.`)}
    />
  );
}

export function ReviewActions({ item, onDone }: ActionProps) {
  const allowed = reviewActions(item);
  return (
    <>
      {allowed.approve ? <ApproveButton item={item} onDone={onDone} /> : null}
      {allowed.close ? <SimpleReasonAction item={item} onDone={onDone} kind="close" /> : null}
      {allowed.merge ? <SimpleReasonAction item={item} onDone={onDone} kind="merge" /> : null}
      {allowed.override ? <OverrideDialog item={item} onDone={onDone} /> : null}
      {allowed.reject ? <SimpleReasonAction item={item} onDone={onDone} kind="reject" /> : null}
    </>
  );
}
