// Cevrimdisi bildirim sirasi (docs/UI_GUIDE.md bolum 5.1): internet yokken gonderilen bildirim bu cihazda
// saklanir, baglanti gelince uygulama acikken kendiliginden gonderilir. Burada yalniz kurallar ve metinler;
// saklama lib/pendingStore.ts, gonderme hooks/usePendingReports.ts.
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/dates";

export interface PendingReport {
  id: string;
  // Yalniz kaydeden kullanicinin oturumunda gosterilir ve gonderilir
  userId: number;
  description: string;
  locationId: number;
  files: File[];
  savedAt: string;
  // Backend reddettiyse sebebi (Turkce, backend'den); null ise siradaki denemede gonderilir
  error: string | null;
}

// Bildirim kaydedildikten sonra dosya yuklenirken baglanti koparsa: bildirim yeniden gonderilmez (iki kez
// olusmasin), yalniz o dosyanin yuklenemedigi soylenir
export const UPLOAD_LOST_MESSAGE = "Bağlantı koptuğu için yüklenemedi.";

export function pendingTitle(count: number): string {
  return `Gönderilmeyi bekleyen ${count} bildirim`;
}

export function pendingMeta(report: PendingReport, locationName: string): string {
  const parts = [locationName];
  if (report.files.length > 0) {
    parts.push(`${report.files.length} dosya`);
  }
  parts.push(formatDateTime(report.savedAt));
  return parts.join(" · ");
}

export function pendingStatus(report: PendingReport): { text: string; failed: boolean } {
  return report.error === null
    ? { text: "İnternet gelince gönderilecek.", failed: false }
    : { text: `Gönderilemedi: ${report.error}`, failed: true };
}

export function pendingSentText(caseNumber: string): string {
  return `Bekleyen bildirimin gönderildi: ${caseNumber}`;
}

// Yalniz ag hatasi (backend'den hic cevap gelmedi) siraya alinir. Backend cevap verdiyse (ApiError) ayni
// istek tekrar denense de reddedilir: hata formda gosterilir
export function queuedAfter(error: unknown): boolean {
  return error instanceof TypeError && !(error instanceof ApiError);
}
