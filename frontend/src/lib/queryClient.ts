import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api/client";

// Ag kesintisi gecici olabilir; bir kez daha denemek yeterli, fazlasi ekrani bekletir
const NETWORK_RETRY_LIMIT = 1;

// Backend cevap verdiyse (4xx/5xx) sonuc kesindir; tekrar denemek yalniz hatayi geciktirir
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(error instanceof ApiError) && failureCount < NETWORK_RETRY_LIMIT;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
}
