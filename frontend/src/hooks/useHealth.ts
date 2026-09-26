import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type Health = components["schemas"]["HealthRead"];

// 503 kesin bir cevaptir (DB yok); yeniden denemek yalniz ekrani ~10 sn bekletir.
// Durum 30 sn'de bir tazelenir ki DB geri gelince sayfa yenilenmeden yesile donsun.
const HEALTH_REFRESH_MS = 30_000;

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<Health>("/health"),
    retry: false,
    refetchInterval: HEALTH_REFRESH_MS,
  });
}
