import { useQuery } from "@tanstack/react-query";

import { apiGet, apiGetBlob } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type AttachmentRead = components["schemas"]["AttachmentRead"];

export const caseAttachmentsKey = (caseId: number) => ["cases", String(caseId), "attachments"];

// Personelin yukledigi kanit dosyalari (kind EVIDENCE); bildirenin fotograflari burada gosterilmez
export function useCaseEvidence(caseId: number) {
  return useQuery({
    queryKey: caseAttachmentsKey(caseId),
    queryFn: () => apiGet<AttachmentRead[]>(`/cases/${caseId}/attachments`),
    select: (items) => items.filter((item) => item.kind === "EVIDENCE"),
  });
}

// Indirme yetki ister: <img src> dogrudan kullanilamaz, dosya Bearer ile alinip gecici adrese cevrilir
// (docs/API.md). Adres sorgu onbelleginde durdugu surece gecerlidir; sayfa kapaninca tarayici siler.
export function useAttachmentImage(attachmentId: number) {
  return useQuery({
    queryKey: ["attachments", attachmentId, "image"],
    queryFn: async () => URL.createObjectURL(await apiGetBlob(`/attachments/${attachmentId}`)),
    staleTime: Infinity,
  });
}
