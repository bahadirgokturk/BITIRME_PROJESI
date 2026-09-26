import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type Health = components["schemas"]["HealthRead"];

// Durum 30 sn'de bir tazelenir ki DB geri gelince sayfa yenilenmeden yesile donsun.
// Yeniden deneme politikasi lib/queryClient.ts'te (503 gibi kesin cevaplar tekrar denenmez).
const HEALTH_REFRESH_MS = 30_000;

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<Health>("/health"),
    refetchInterval: HEALTH_REFRESH_MS,
  });
}
