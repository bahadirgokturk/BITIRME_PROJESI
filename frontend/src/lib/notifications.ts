import type { components } from "@/lib/api/types";

type Role = components["schemas"]["UserRole"];
export type NotificationRead = components["schemas"]["NotificationRead"];

// Rozette en fazla tek hane; daha fazlasi "9+" (dar alanda okunur kalsin)
const BADGE_MAX = 9;

// Bildirimdeki kayit her rolde kendi detay ekraninda acilir (/cases/[id] bildirenin sade ekrani)
const CASE_SCREEN: Record<Role, string> = {
  REPORTER: "/cases",
  STAFF: "/staff/cases",
  MANAGER: "/manager/cases",
  ADMIN: "/manager/cases",
};

export function notificationHref(role: Role, caseId: number): string {
  return `${CASE_SCREEN[role]}/${caseId}`;
}

export function unreadBadge(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return count > BADGE_MAX ? `${BADGE_MAX}+` : String(count);
}

// Rozet yalniz gorsel: sayi ekran okuyucuya dugmenin adiyla soylenir
export function bellLabel(count: number): string {
  return count > 0 ? `Bildirimler: ${count} okunmamış` : "Bildirimler: okunmamış yok";
}
