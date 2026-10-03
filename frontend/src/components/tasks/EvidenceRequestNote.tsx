"use client";

import { TriangleAlertIcon } from "lucide-react";

import { useCaseEvents } from "@/hooks/useCases";
import { evidenceRequest, type TaskRead } from "@/lib/tasks";

// Tamamlanan is yetersiz bulununca gorev personele geri doner; eksik ne, olay gecmisindeki
// EVIDENCE_REQUESTED mesajinda yazar (docs/WORKFLOW.md "Case - Task senkronizasyonu")
export function EvidenceRequestNote({ task }: { task: TaskRead }) {
  const events = useCaseEvents(String(task.case_id));
  if (events.isError) {
    return <p className="text-sm text-muted-foreground">Görev geçmişi yüklenemedi.</p>;
  }
  const message = evidenceRequest(events.data ?? [], task.id);
  if (!message) {
    return null;
  }
  return (
    <div role="status" className="flex gap-2 rounded-md bg-warning/10 p-3 text-sm">
      <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>
        <p className="font-semibold">Eksik kanıt: görev sana geri döndü</p>
        <p className="mt-0.5">{message}</p>
      </div>
    </div>
  );
}
