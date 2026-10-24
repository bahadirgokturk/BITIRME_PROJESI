"use client";

import { useCreateReport } from "@/hooks/useReport";
import { clearReportDraft, useReportDraftKey } from "@/hooks/useReportDraft";

import { ReportConfirmation } from "./ReportConfirmation";
import { ReportForm } from "./ReportForm";

// Gonderim basariliysa onay ekrani; "Yeni bildirim yap" sonucu sifirlar ve form bos acilir.
// Gonderilen bildirimin taslagi silinir: form bir dahaki acilista bos gelir
export function ReportScreen() {
  const draftKey = useReportDraftKey();
  const mutation = useCreateReport(() => clearReportDraft(draftKey));
  if (mutation.isSuccess) {
    return <ReportConfirmation result={mutation.data} onNewReport={() => mutation.reset()} />;
  }
  return <ReportForm mutation={mutation} draftKey={draftKey} />;
}
