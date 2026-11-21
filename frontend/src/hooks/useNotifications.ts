import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];

const NOTIFICATIONS_KEY = ["notifications"];
// Zil rozeti: iki dakikada bir yeterince taze; sekmeye donunce ve baglanti gelince zaten yeniden okunur
const UNREAD_REFRESH_MS = 120_000;
// Pencerede son 20 bildirim; daha eskisi icin kaydin kendi zaman cizelgesi var
const LIST_SIZE = 20;

// enabled: rozet sayfa acilisi bittikten sonra sorulur (hooks/useIdleStart.ts)
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, "unread-count"],
    queryFn: () => apiGet<Schemas["UnreadCount"]>("/notifications/unread-count"),
    select: (data) => data.count,
    refetchInterval: UNREAD_REFRESH_MS,
    enabled,
  });
}

// Liste yalniz zil acilinca okunur
export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, "list"],
    queryFn: () => apiGet<Schemas["Page_NotificationRead_"]>(`/notifications?page=1&page_size=${LIST_SIZE}`),
    select: (page) => page.items,
    enabled,
  });
}

function useNotificationAction<T>(send: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useMarkRead() {
  return useNotificationAction((id: number) => apiPost<void>(`/notifications/${id}/read`));
}

export function useMarkAllRead() {
  return useNotificationAction(() => apiPost<void>("/notifications/read-all"));
}
