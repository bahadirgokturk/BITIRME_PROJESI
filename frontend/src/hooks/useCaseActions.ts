import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type CaseRead = Schemas["CaseRead"];

// Uc islem de guncel bildirimi dondurur: detay hemen guncellenir, liste ve zaman cizelgesi yeniden okunur
function useCaseAction<Body>(caseId: number, action: "info" | "feedback" | "reopen") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Body) => apiPost<CaseRead>(`/cases/${caseId}/${action}`, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["cases", String(caseId)], updated);
      return queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

// NEEDS_INFO sorusuna yanit; bildirim yeniden incelemeye doner
export function useReplyInfo(caseId: number) {
  return useCaseAction<Schemas["InfoReplyCreate"]>(caseId, "info");
}

export function useSubmitFeedback(caseId: number) {
  return useCaseAction<Schemas["FeedbackCreate"]>(caseId, "feedback");
}

export function useReopenCase(caseId: number) {
  return useCaseAction<Schemas["ReopenRequest"]>(caseId, "reopen");
}
