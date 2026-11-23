"use client";

import { useSubmitReport } from "@/hooks/usePendingReports";
import { clearReportDraft, useReportDraftKey } from "@/hooks/useReportDraft";
import { useSupportCase } from "@/hooks/useSimilarCases";

import { QueuedConfirmation, ReportConfirmation, SupportConfirmation } from "./ReportConfirmation";
import { ReportForm } from "./ReportForm";

// Gonderim basariliysa onay ekrani; internet yoksa "kaydedildi" ekrani (bildirim bu cihazda sirada).
// "Yeni bildirim yap" sonucu sifirlar ve form bos acilir.
// Gonderilen bildirimin taslagi silinir: form bir dahaki acilista bos gelir. qrLocation: kapidaki QR'in ?location= degeri
export function ReportScreen({ qrLocation }: { qrLocation?: string }) {
  const draftKey = useReportDraftKey();
  const mutation = useSubmitReport(() => clearReportDraft(draftKey));
  const support = useSupportCase(() => clearReportDraft(draftKey));
  if (support.data) {
    return <SupportConfirmation caseNumber={support.data.case_number} onNewReport={() => support.reset()} />;
  }
  if (mutation.data?.kind === "queued") {
    return <QueuedConfirmation onNewReport={() => mutation.reset()} />;
  }
  if (mutation.data?.kind === "sent") {
    return <ReportConfirmation result={mutation.data.result} onNewReport={() => mutation.reset()} />;
  }
  return <ReportForm mutation={mutation} support={support} draftKey={draftKey} qrLocation={qrLocation} />;
}
