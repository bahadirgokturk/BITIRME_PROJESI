import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiGet, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type LocationOption = Schemas["LocationOption"];

// Backend'in page_size ust siniri; kampusun tum konumlari tek listede gelir (arama ?q= gelince degisir)
const LOCATIONS_PAGE_SIZE = 200;

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: () => apiGet<Schemas["Page_LocationOption_"]>(`/locations?page_size=${LOCATIONS_PAGE_SIZE}`),
    select: (page) => page.items,
  });
}

export interface ReportInput {
  description: string;
  locationId: number;
  files: File[];
}

export interface UploadFailure {
  fileName: string;
  message: string;
}

export interface ReportResult {
  created: Schemas["CaseRead"];
  failedUploads: UploadFailure[];
}

function uploadReportFile(caseId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<Schemas["AttachmentRead"]>(`/cases/${caseId}/attachments`, { method: "POST", body: form });
}

// Dosyalar bildirim olustuktan sonra tek tek yuklenir (docs/API.md). Bildirim artik kayitli oldugu icin
// backend'in bir dosyayi reddetmesi (413/415/422) gonderimi geri almaz: hangi dosyanin neden yuklenemedigi
// onay ekraninda yazilir. Ag hatasi gibi ApiError olmayan hatalar yutulmaz.
async function uploadAll(caseId: number, files: File[]): Promise<UploadFailure[]> {
  const failures: UploadFailure[] = [];
  for (const file of files) {
    try {
      await uploadReportFile(caseId, file);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error;
      }
      failures.push({ fileName: file.name, message: error.message });
    }
  }
  return failures;
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ description, locationId, files }: ReportInput): Promise<ReportResult> => {
      const body: Schemas["CaseCreate"] = { description: description.trim(), location_id: locationId };
      const created = await apiPost<Schemas["CaseRead"]>("/cases", body);
      return { created, failedUploads: await uploadAll(created.id, files) };
    },
    // Bildirimlerim listesi yeni kaydi gostersin
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cases", "mine"] }),
  });
}
