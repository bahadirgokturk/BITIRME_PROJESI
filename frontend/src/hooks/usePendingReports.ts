"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOnline } from "@/hooks/useOnline";
import { sendReport, type ReportInput, type ReportResult } from "@/hooks/useReport";
import { ApiError } from "@/lib/api/client";
import { queuedAfter, type PendingReport } from "@/lib/pendingReports";
import { pendingStore, type PendingStore } from "@/lib/pendingStore";

export type SubmitResult = { kind: "sent"; result: ReportResult } | { kind: "queued" };

export interface SentReport {
  caseId: number;
  caseNumber: string;
}

const pendingKey = (userId: number | undefined) => ["pending-reports", userId] as const;
const sentKey = (userId: number | undefined) => ["pending-reports", "sent", userId] as const;

function toPending(input: ReportInput, userId: number, id: string): PendingReport {
  return {
    id,
    userId,
    description: input.description.trim(),
    locationId: input.locationId,
    files: input.files,
    savedAt: new Date().toISOString(),
    error: null,
  };
}

// Internet yoksa bildirim hic gonderilmeden siraya alinir; gonderirken ag hatasi olursa da (backend cevap
// vermedi). Backend cevap verdiyse hata formda gosterilir. Sira yoksa (IndexedDB yok) eskisi gibi hata.
// Siradaki kaydin kimligi gonderimdeki anahtarla ayni: istek ulasip cevap kaybolduysa tekrar acilmaz
async function submit(input: ReportInput, online: boolean, userId: number | undefined): Promise<SubmitResult> {
  const store = pendingStore();
  const key = crypto.randomUUID();
  const queue = async (id: number) => {
    await store?.put(toPending(input, id, key));
    return { kind: "queued" } as const;
  };
  if (!online && store && userId !== undefined) {
    return queue(userId);
  }
  try {
    return { kind: "sent", result: await sendReport(input, key) };
  } catch (error) {
    if (store && userId !== undefined && queuedAfter(error)) {
      return queue(userId);
    }
    throw error;
  }
}

// onSaved: bildirim gonderildi ya da siraya alindi (taslak silinir; veri artik sunucuda ya da sirada)
export function useSubmitReport(onSaved?: () => void) {
  const queryClient = useQueryClient();
  const online = useOnline();
  const userId = useCurrentUser().data?.id;
  return useMutation({
    mutationFn: (input: ReportInput) => submit(input, online, userId),
    // TanStack Query cevrimdisiyken gonderimi bekletir; burada cevrimdisi durum bilerek ele alinir (siraya alma)
    networkMode: "always",
    onSuccess: (outcome) => {
      onSaved?.();
      const key = outcome.kind === "sent" ? ["cases", "mine"] : pendingKey(userId);
      return queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// Bu cihazda bu kullanicinin bekleyen bildirimleri (en eski once)
export function usePendingReports() {
  const userId = useCurrentUser().data?.id;
  const store = pendingStore();
  return useQuery({
    queryKey: pendingKey(userId),
    queryFn: () => store?.list(userId ?? -1) ?? Promise.resolve([]),
    enabled: userId !== undefined && store !== null,
    // Cihazdaki depodan okunur: internet yokken de liste gosterilir
    networkMode: "always",
  });
}

export function useSentReports(): SentReport[] {
  const userId = useCurrentUser().data?.id;
  const sent = useQuery({
    queryKey: sentKey(userId),
    queryFn: () => [] as SentReport[],
    staleTime: Infinity,
    networkMode: "always",
  });
  return sent.data ?? [];
}

export function useRemovePending() {
  const queryClient = useQueryClient();
  const userId = useCurrentUser().data?.id;
  return useMutation({
    mutationFn: async (id: string) => pendingStore()?.remove(id),
    networkMode: "always",
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingKey(userId) }),
  });
}

// Sirayi sirayla gonderir. Gonderilen silinir ve numarasi hatirlanir; backend reddederse sebebiyle kalir
// (kullanici siler); ag hatasinda durur: baglanti tekrar gelince yeniden denenir
async function sendWaiting(reports: PendingReport[], store: PendingStore, queryClient: QueryClient, userId: number) {
  for (const report of reports) {
    try {
      const { created } = await sendReport(report, report.id);
      await store.remove(report.id);
      const sent: SentReport = { caseId: created.id, caseNumber: created.case_number };
      queryClient.setQueryData<SentReport[]>(sentKey(userId), (old = []) => [...old, sent]);
    } catch (error) {
      if (queuedAfter(error)) {
        break;
      }
      if (!(error instanceof ApiError)) {
        throw error;
      }
      await store.put({ ...report, error: error.message });
    }
  }
  await queryClient.invalidateQueries({ queryKey: pendingKey(userId) });
  await queryClient.invalidateQueries({ queryKey: ["cases", "mine"] });
}

// Uygulama kabugunda calisir: baglanti varken bekleyen (reddedilmemis) bildirimleri gonderir. Ag hatasi
// baglantiyi "yok" yapar (client.ts), boylece ayni bildirim baglanti gelene kadar tekrar denenmez
export function usePendingSync() {
  const online = useOnline();
  const userId = useCurrentUser().data?.id;
  const queryClient = useQueryClient();
  const pending = usePendingReports();
  const running = useRef(false);
  useEffect(() => {
    const store = pendingStore();
    const waiting = pending.data?.filter((report) => report.error === null) ?? [];
    if (!online || running.current || !store || userId === undefined || waiting.length === 0) {
      return;
    }
    running.current = true;
    void sendWaiting(waiting, store, queryClient, userId).finally(() => {
      running.current = false;
    });
  }, [online, pending.data, userId, queryClient]);
}
