import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useOnline } from "@/hooks/useOnline";
import { apiPost } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { descriptionProblem } from "@/lib/report";

type Schemas = components["schemas"];
export type SimilarOpenCase = Schemas["SimilarOpenCase"];

// Yazmayi biraktiktan bu kadar sonra sorulur: her tus vurusunda agent calismasin
const SIMILAR_DELAY_MS = 600;

// Bildirmeden once tekrar kontrolu (POST /cases/similar): aciklama gecerli, konum secili ve internet varken
// ayni binadaki benzer acik bildirimler. Hata olursa sessiz kalir; form her durumda gonderilebilir
export function useSimilarCases(description: string, locationId: string) {
  const text = useDebouncedValue(description.trim(), SIMILAR_DELAY_MS);
  const online = useOnline();
  const ready = online && locationId !== "" && descriptionProblem(text) === null;
  return useQuery({
    queryKey: ["cases", "similar", text, locationId],
    queryFn: () =>
      apiPost<Schemas["SimilarRead"]>("/cases/similar", { description: text, location_id: Number(locationId) }),
    select: (data) => data.items,
    enabled: ready,
    retry: false,
  });
}

export interface SupportInput {
  description: string;
  locationId: number;
  caseId: number;
}

// "Ben de yasiyorum": kisinin kaydi acilir ve gosterilen bildirime baglanir (POST /cases/support)
export function useSupportCase(onSaved?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ description, locationId, caseId }: SupportInput) =>
      apiPost<Schemas["CaseRead"]>("/cases/support", {
        description: description.trim(),
        location_id: locationId,
        case_id: caseId,
      }),
    onSuccess: () => {
      onSaved?.();
      return queryClient.invalidateQueries({ queryKey: ["cases", "mine"] });
    },
  });
}
