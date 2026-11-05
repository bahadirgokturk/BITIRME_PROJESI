// Bildirim yapanin kapanmis bildirimde yapabilecekleri: puan ve yeniden acma (docs/API.md "Yorum, puan,
// yeniden acma"). Kurallari backend denetler; burasi yalniz hangi kutunun gosterilecegine karar verir.
import type { components } from "@/lib/api/types";

type CaseRead = components["schemas"]["CaseRead"];

// Backend ile ayni degerler: backend/app/core/constants.py REOPEN_WINDOW_HOURS, REOPEN_REASON_MAX_LENGTH
export const ACTION_WINDOW_HOURS = 72;
export const REOPEN_REASON_MAX_LENGTH = 1000;

const MS_PER_HOUR = 3_600_000;

export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];

const RATING_WORDS: Record<Rating, string> = {
  1: "Çok kötü",
  2: "Kötü",
  3: "Orta",
  4: "İyi",
  5: "Çok iyi",
};

export function ratingLabel(rating: Rating): string {
  return `${rating} / ${RATINGS.length} · ${RATING_WORDS[rating]}`;
}

export interface ClosedCaseActions {
  canRate: boolean;
  canReopen: boolean;
  rating: number | null;
}

type ClosedFields = Pick<CaseRead, "status" | "closed_at" | "satisfaction_rating">;

// Son kapanistan sonraki 72 saat: puan bir kez verilir, yeniden acma puandan bagimsizdir
export function closedCaseActions(item: ClosedFields, now: Date = new Date()): ClosedCaseActions {
  const rating = item.satisfaction_rating;
  if (item.status !== "CLOSED" || item.closed_at === null) {
    return { canRate: false, canReopen: false, rating };
  }
  const hoursSinceClosed = (now.getTime() - new Date(item.closed_at).getTime()) / MS_PER_HOUR;
  const windowOpen = hoursSinceClosed <= ACTION_WINDOW_HOURS;
  return { canRate: windowOpen && rating === null, canReopen: windowOpen, rating };
}

export function isValidReopenReason(reason: string): boolean {
  const length = reason.trim().length;
  return length > 0 && length <= REOPEN_REASON_MAX_LENGTH;
}

// Bildirim zilindeki "Sizden yanit bekleniyor" listesi: ek bilgi istenenler once, sonra kapanip
// 72 saat icinde puan verilmemis olanlar (closedCaseActions ile ayni kural)
const WAITING_REASONS = {
  info: "Sizden ek bilgi istendi",
  rating: "Çözüldü · değerlendirmenizi bekliyor",
} as const;

export interface WaitingCase {
  item: CaseRead;
  reason: string;
}

export function actionNeeded(items: readonly CaseRead[], now: Date = new Date()): WaitingCase[] {
  const info = items.filter((item) => item.status === "NEEDS_INFO");
  const rating = items.filter((item) => closedCaseActions(item, now).canRate);
  return [
    ...info.map((item) => ({ item, reason: WAITING_REASONS.info })),
    ...rating.map((item) => ({ item, reason: WAITING_REASONS.rating })),
  ];
}

// duplicate_count: bu bildirime eklenen baska bildirimler (backend/app/services/merge.py); bildiren de sayilir
export function reportedByText(duplicateCount: number): string | null {
  return duplicateCount > 0 ? `Bu sorunu siz dahil ${duplicateCount + 1} kişi bildirdi.` : null;
}
