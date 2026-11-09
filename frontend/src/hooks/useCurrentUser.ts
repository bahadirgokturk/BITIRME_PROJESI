import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type CurrentUser = components["schemas"]["UserRead"];

// Kullanici bilgisi seyrek degisir; giris ve cikista onbellek zaten tamamen temizlenir (queryClient.clear).
// Bu sure olmadan sorguyu kullanan her yeni bilesen (kabuk, sayfa) ikinci bir /auth/me istegi gonderir.
const USER_STALE_MS = 5 * 60_000;

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<CurrentUser>("/auth/me"),
    staleTime: USER_STALE_MS,
  });
}
