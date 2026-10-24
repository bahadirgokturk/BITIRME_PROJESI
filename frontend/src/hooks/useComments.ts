import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import type { CommentRead } from "@/lib/comments";
import { LIVE_QUERY } from "@/lib/queryClient";

type CommentCreate = components["schemas"]["CommentCreate"];

const commentsKey = (caseId: number) => ["cases", String(caseId), "comments"];

// Backend ic notlari role gore suzer: bildiren yalniz herkese acik yorumlari alir
export function useCaseComments(caseId: number) {
  return useQuery({
    queryKey: commentsKey(caseId),
    queryFn: () => apiGet<CommentRead[]>(`/cases/${caseId}/comments`),
    ...LIVE_QUERY,
  });
}

// Yeni yorum listeye eklenir; mudurun zaman cizelgesi de yenilenir (COMMENT_ADDED olayi)
export function useAddComment(caseId: number, onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CommentCreate) => apiPost<CommentRead>(`/cases/${caseId}/comments`, body),
    onSuccess: () => {
      onDone();
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: commentsKey(caseId) }),
        queryClient.invalidateQueries({ queryKey: ["cases", String(caseId), "events"] }),
      ]);
    },
  });
}
