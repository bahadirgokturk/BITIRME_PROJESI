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
  { prefix: "/staff/tasks/", bar: { kind: "back", title: "Görev", backHref: "/staff/tasks" } },
];

export function mobileBarFor(pathname: string): MobileBar {
  const match = BACK_BARS.find((entry) => pathname.startsWith(entry.prefix));
  return match?.bar ?? { kind: "menu" };
}

const REPORTER_KIND_LABELS: Record<ReporterKind, string> = {
  STUDENT: "Öğrenci",
  ACADEMIC: "Akademik personel",
  PERSONNEL: "İdari personel",
};

const ROLE_LABELS: Record<Role, string> = {
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
