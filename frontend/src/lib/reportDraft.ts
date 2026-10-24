// Bildirim formunun taslagi (docs/UI_GUIDE.md bolum 5.1). Bu cihazda, giris yapan kisiye ozel saklanir;
// cikis yapinca silinir. Dosyalar saklanamaz: yalniz "dosya vardi" bilgisi tutulur ki kullaniciya hatirlatilsin.
export const REPORT_DRAFT_PREFIX = "bakircayflow-report-draft:";

export interface ReportDraft {
  description: string;
  locationId: string;
  hadFiles: boolean;
}

export function reportDraftKey(userId: number): string {
  return `${REPORT_DRAFT_PREFIX}${userId}`;
}

function isDraft(value: unknown): value is ReportDraft {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.description === "string" && typeof draft.locationId === "string" && typeof draft.hadFiles === "boolean"
  );
}

// Bozuk ya da baska bicimdeki deger taslak sayilmaz; form bos acilir
export function parseReportDraft(raw: string | null): ReportDraft | null {
  if (raw === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    return isDraft(value) ? value : null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

// Yazi da konum da yoksa saklanacak bir sey yoktur (yalniz dosya secilmisse de: dosya saklanmaz)
export function isBlankDraft(draft: ReportDraft): boolean {
  return draft.description.trim() === "" && draft.locationId === "";
}

// QR ile acilan form kapidaki yer icindir: taslaktaki eski konum kullanilmaz, aciklama yine taslaktan gelir.
// Taslakta konumdan baska bir sey yoksa geri yuklenecek bir sey de yoktur
export function draftForForm(draft: ReportDraft | null, fromQr: boolean): ReportDraft | null {
  if (!draft || !fromQr) {
    return draft;
  }
  return draft.description.trim() === "" && !draft.hadFiles ? null : { ...draft, locationId: "" };
}
