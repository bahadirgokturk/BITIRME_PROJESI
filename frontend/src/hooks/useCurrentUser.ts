import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type CurrentUser = components["schemas"]["UserRead"];

export function useCurrentUser() {
  return useQuery({ queryKey: ["auth", "me"], queryFn: () => apiGet<CurrentUser>("/auth/me") });
}
