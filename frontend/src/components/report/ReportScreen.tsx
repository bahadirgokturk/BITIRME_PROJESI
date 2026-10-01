"use client";

import { useCreateReport } from "@/hooks/useReport";

import { ReportConfirmation } from "./ReportConfirmation";
import { ReportForm } from "./ReportForm";

// Gonderim basariliysa onay ekrani; "Yeni bildirim yap" sonucu sifirlar ve form bos acilir
export function ReportScreen() {
  const mutation = useCreateReport();
  if (mutation.isSuccess) {
    return <ReportConfirmation result={mutation.data} onNewReport={() => mutation.reset()} />;
  }
  return <ReportForm mutation={mutation} />;
}
