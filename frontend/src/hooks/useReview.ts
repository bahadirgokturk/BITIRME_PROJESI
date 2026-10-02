import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type ReviewItem = Schemas["ReviewItemRead"];
export type AgentDecision = Schemas["AgentDecisionRead"];
type CaseRead = Schemas["CaseRead"];

const REVIEW_QUEUE_KEY = ["manager", "review-queue"];
// Kuyruk kisa tutulur (agent'larin emin olamadigi kayitlar); 100 kayit tek sayfada gelir, backend siniri 200
const REVIEW_PAGE_SIZE = 100;

export function useReviewQueue() {
  return useQuery({
    queryKey: REVIEW_QUEUE_KEY,
    queryFn: () => apiGet<Schemas["Page_ReviewItemRead_"]>(`/manager/review-queue?page_size=${REVIEW_PAGE_SIZE}`),
  });
}

// Gerekce paneli acilinca yuklenir; kapaliyken istek atilmaz
export function useCaseDecisions(caseId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["cases", String(caseId), "decisions"],
    queryFn: () => apiGet<AgentDecision[]>(`/cases/${caseId}/decisions`),
    enabled,
  });
}

export type ReviewAction = "assign" | "override" | "reject" | "merge" | "close";

// Her islem guncel bildirimi doner; kuyruk ve bildirim listeleri yeniden okunur
export function useReviewAction<Body>(caseId: number, action: ReviewAction) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Body) => apiPost<CaseRead>(`/cases/${caseId}/${action}`, body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY }),
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
      ]),
  });
}
