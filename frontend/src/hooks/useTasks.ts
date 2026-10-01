import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { apiGet, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import type { TaskRead } from "@/lib/tasks";

import { caseAttachmentsKey } from "./useAttachments";

type Schemas = components["schemas"];
type TaskPage = Schemas["Page_TaskRead_"];

// Personelin yapilacak isleri; backend SLA'ya kalan sureye gore siralar (docs/UI_GUIDE.md bolum 5.3)
export function useMyTasks() {
  return useQuery({
    queryKey: ["tasks", "mine"],
    queryFn: () => apiGet<TaskPage>("/tasks/mine"),
  });
}

// Kapsam disi ya da olmayan gorev backend'den 404 doner (IDOR); ekran ikisini ayirt etmez
export function useTask(taskId: string) {
  return useQuery({
    queryKey: ["tasks", taskId],
    queryFn: () => apiGet<TaskRead>(`/tasks/${encodeURIComponent(taskId)}`),
  });
}

// Her islem guncel gorevi dondurur: detay hemen guncellenir, liste yeniden okunur
function useTaskMutation<Input>(taskId: number, run: (input: Input) => Promise<TaskRead>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (updated) => {
      queryClient.setQueryData(["tasks", String(taskId)], updated);
      return queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] });
    },
  });
}

export function useAcceptTask(taskId: number) {
  return useTaskMutation<void>(taskId, () => apiPost<TaskRead>(`/tasks/${taskId}/accept`));
}

export function useStartTask(taskId: number) {
  return useTaskMutation<void>(taskId, () => apiPost<TaskRead>(`/tasks/${taskId}/start`));
}

export function useDeclineTask(taskId: number) {
  return useTaskMutation<Schemas["DeclineRequest"]>(taskId, (body) =>
    apiPost<TaskRead>(`/tasks/${taskId}/decline`, body),
  );
}

export interface TaskNoteInput {
  note: string;
  photos: File[];
}

// Personelin bildirime yukledigi dosyayi backend kanit (EVIDENCE) olarak kaydeder
function uploadEvidence(caseId: number, photo: File) {
  const form = new FormData();
  form.append("file", photo);
  return apiRequest<Schemas["AttachmentRead"]>(`/cases/${caseId}/attachments`, { method: "POST", body: form });
}

// Once kanit fotograflari sirayla yuklenir; biri basarisizsa gorev tamamlanmaz (kanitsiz kapanmasin).
// Yuklenenler hatirlanir: kullanici yeniden denediginde ayni fotograf ikinci kez yuklenmez.
export function useCompleteTask(task: Pick<TaskRead, "id" | "case_id">) {
  const queryClient = useQueryClient();
  const uploaded = useRef(new Set<File>());
  return useTaskMutation<TaskNoteInput>(task.id, async ({ note, photos }) => {
    for (const photo of photos.filter((item) => !uploaded.current.has(item))) {
      await uploadEvidence(task.case_id, photo);
      uploaded.current.add(photo);
    }
    await queryClient.invalidateQueries({ queryKey: caseAttachmentsKey(task.case_id) });
    const body: Schemas["CompleteRequest"] = { completion_note: note || null };
    return apiPost<TaskRead>(`/tasks/${task.id}/complete`, body);
  });
}
