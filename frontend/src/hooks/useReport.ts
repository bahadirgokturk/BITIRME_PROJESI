import { useQuery } from "@tanstack/react-query";

import { ApiError, apiGet, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { queuedAfter, UPLOAD_LOST_MESSAGE } from "@/lib/pendingReports";

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

// Kapidaki QR'in gosterdigi konum (GET /locations/{id}); pasif ya da baska kurumun konumu 404 doner.
// Kod okunamadiysa (id null) hic istenmez
export function useQrLocation(id: number | null) {
  return useQuery({
    queryKey: ["locations", id],
    queryFn: () => apiGet<LocationOption>(`/locations/${id}`),
    enabled: id !== null,
    retry: false,
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

// Yuklenemeyen dosyanin sebebi: backend'in mesaji ya da kopan baglanti. Baska hata yutulmaz
function uploadProblem(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (queuedAfter(error)) {
    return UPLOAD_LOST_MESSAGE;
  }
  throw error;
}

// Dosyalar bildirim olustuktan sonra tek tek yuklenir (docs/API.md). Bildirim artik kayitli oldugu icin
// backend'in bir dosyayi reddetmesi (413/415/422) ya da baglantinin kopmasi gonderimi geri almaz: hangi
// dosyanin neden yuklenemedigi onay ekraninda yazilir (bildirim yeniden gonderilip iki kez olusmaz)
async function uploadAll(caseId: number, files: File[]): Promise<UploadFailure[]> {
  const failures: UploadFailure[] = [];
  for (const file of files) {
    try {
      await uploadReportFile(caseId, file);
    } catch (error) {
      failures.push({ fileName: file.name, message: uploadProblem(error) });
    }
  }
  return failures;
}

// Bildirimi olusturur, sonra dosyalari yukler. Form ve cevrimdisi sira ayni yoldan gonderir
// (hooks/usePendingReports.ts)
export async function sendReport({ description, locationId, files }: ReportInput): Promise<ReportResult> {
  const body: Schemas["CaseCreate"] = { description: description.trim(), location_id: locationId };
  const created = await apiPost<Schemas["CaseRead"]>("/cases", body);
  return { created, failedUploads: await uploadAll(created.id, files) };
}
