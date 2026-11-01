// Uygulama kabugu icin saf fonksiyonlar: mobil ust cubuk turu ve kullanici alt yazisi
// (Figma: 02 Components > MobileAppBar, MobileMenuSheet)
import type { components } from "@/lib/api/types";

type User = components["schemas"]["UserRead"];
type ReporterKind = components["schemas"]["ReporterKind"];
type Role = components["schemas"]["UserRole"];

export type MobileBar =
  | { kind: "menu" }
  | { kind: "back"; title: string; backHref: string };

// Alt sayfalar: telefonda menu yerine geri butonu cikar. Geri adresi sabittir; PWA'da sayfa
// dogrudan acilmis olabilir ve tarayici gecmisi bos olabilir.
const BACK_BARS: readonly { prefix: string; bar: MobileBar }[] = [
  { prefix: "/cases/", bar: { kind: "back", title: "Bildirim", backHref: "/my-cases" } },
  { prefix: "/manager/cases/", bar: { kind: "back", title: "Bildirim", backHref: "/manager/cases" } },
  { prefix: "/manager/departments/", bar: { kind: "back", title: "Birim", backHref: "/manager/departments" } },
  { prefix: "/staff/cases/", bar: { kind: "back", title: "Bildirim", backHref: "/staff/cases" } },
  { prefix: "/staff/tasks/", bar: { kind: "back", title: "Görev", backHref: "/staff/tasks" } },
];

export function mobileBarFor(pathname: string): MobileBar {
  const match = BACK_BARS.find((entry) => pathname.startsWith(entry.prefix));
  return match?.bar ?? { kind: "menu" };
}

export const REPORTER_KIND_LABELS: Record<ReporterKind, string> = {
  STUDENT: "Öğrenci",
  ACADEMIC: "Akademik personel",
  PERSONNEL: "İdari personel",
};

export const ROLE_LABELS: Record<Role, string> = {
  REPORTER: "Bildirim yapan",
  STAFF: "Personel",
  MANAGER: "Birim müdürü",
  ADMIN: "Sistem yöneticisi",
};

export function userDetail(user: Pick<User, "role" | "reporter_kind">): string {
  if (user.reporter_kind) {
    return REPORTER_KIND_LABELS[user.reporter_kind];
  }
  return ROLE_LABELS[user.role];
}

// Kenar cubugundaki kullanici kutusu: ad ve soyadin bas harfleri (Ayse Nur Yilmaz -> AY)
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((word) => (word ?? "").charAt(0).toLocaleUpperCase("tr")).join("");
}

// Masaustu kenar cubugunun acik/kapali secimi cihazda saklanir; yoksa ya da bozuksa acik
export const SIDEBAR_KEY = "bakircayflow-sidebar";
export type SidebarState = "open" | "closed";

export function parseSidebarOpen(stored: string | null): boolean {
  return stored !== "closed";
}
