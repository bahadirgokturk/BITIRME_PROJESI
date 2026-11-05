import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api/client";

// Ag kesintisi gecici olabilir; bir kez daha denemek yeterli, fazlasi ekrani bekletir
const NETWORK_RETRY_LIMIT = 1;

// Backend cevap verdiyse (4xx/5xx) sonuc kesindir; tekrar denemek yalniz hatayi geciktirir
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(error instanceof ApiError) && failureCount < NETWORK_RETRY_LIMIT;
}

// Is listeleri baskasinin yaptigi degisikligi (yeni gorev, durum degisimi) sayfa yenilenmeden gostersin.
// Bir dakika: personel ve mudur icin yeterince taze, backend'e de yuk getirmez. Sekme arka plandayken
// ya da baglanti yokken sayac calismaz; sekmeye donunce ve baglanti gelince sorgular zaten yeniden okunur.
export const LIVE_REFRESH_MS = 60_000;
export const LIVE_QUERY = { refetchInterval: LIVE_REFRESH_MS } as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
}
