import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type Health = components["schemas"]["HealthRead"];

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: () => apiGet<Health>("/health") });
}
