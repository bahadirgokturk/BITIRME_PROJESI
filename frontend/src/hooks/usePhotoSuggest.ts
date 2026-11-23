import { useQuery } from "@tanstack/react-query";

import { useOnline } from "@/hooks/useOnline";
import { apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type PhotoTypeSuggestion = Schemas["PhotoTypeSuggestion"];

// Fotograftan tur onerisi (Vision Agent, POST /cases/photo-suggest): fotograf saklanmaz, yalniz onerilir.
// Ayni dosya icin bir kez sorulur; model yoksa ya da anlasilmazsa liste bos doner
export function usePhotoSuggest(file: File | undefined) {
  const online = useOnline();
  return useQuery({
    queryKey: ["photo-suggest", file?.name, file?.size, file?.lastModified],
    queryFn: () => {
      const form = new FormData();
      form.append("file", file as File);
      return apiRequest<Schemas["PhotoSuggestRead"]>("/cases/photo-suggest", { method: "POST", body: form });
    },
    select: (data) => (data.available ? data.suggestions : []),
    enabled: online && file !== undefined,
    staleTime: Infinity,
    retry: false,
  });
}
