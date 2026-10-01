// Rol bazli menu tablosu; yetki matrisi: docs/WORKFLOW.md bolum 4
// Rol kontrolu bilesenlerde if ile degil bu tabloyla yapilir (KOD_KURALLARI kural 2)
import type { components } from "@/lib/api/types";

// Rol tipi backend enum'undan uretilir (ADR-7); NAVIGATION tablosu her rolu kapsamak zorunda
export type Role = components["schemas"]["UserRole"];
export const ROLES: readonly Role[] = ["REPORTER", "STAFF", "MANAGER", "ADMIN"];

export interface NavItem {
  href: string;
  label: string;
  // Bu ogeyi de secili gosteren alt sayfalar (ornek: bildirim detayi listenin altindadir)
  subPaths?: readonly string[];
}

const REPORT: NavItem = { href: "/report", label: "Bildirim yap" };
const MANAGEMENT_VIEWS: NavItem[] = [
  { href: "/manager/dashboard", label: "Dashboard" },
  { href: "/manager/analytics", label: "Analitik" },
  { href: "/manager/agents", label: "Agent'lar" },
];

const NAVIGATION: Record<Role, NavItem[]> = {
  REPORTER: [REPORT, { href: "/my-cases", label: "Bildirimlerim", subPaths: ["/cases"] }],
  STAFF: [REPORT, { href: "/staff/tasks", label: "Görevlerim" }],
  MANAGER: [REPORT, ...MANAGEMENT_VIEWS, { href: "/manager/cases", label: "Case'ler" }],
  ADMIN: [REPORT, ...MANAGEMENT_VIEWS, { href: "/admin", label: "Yönetim" }],
};

export function navigationFor(role: Role): NavItem[] {
  return NAVIGATION[role];
}

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

// Menude secili gosterilecek ogenin adresi; hicbiri eslesmezse null
export function activeNavHref(role: Role, pathname: string): string | null {
  const match = NAVIGATION[role].find((item) =>
    [item.href, ...(item.subPaths ?? [])].some((base) => isUnder(pathname, base)),
  );
  return match?.href ?? null;
}

// Giristen sonra acilan sayfa. Ekrani henuz yapilmamis rollerde null: gecici ana sayfa gosterilir
// (menu adresleri 404 verir). Ekran gelince buraya eklenir.
const HOME_PATHS: Record<Role, string | null> = {
  REPORTER: "/my-cases",
  STAFF: null,
  MANAGER: null,
  ADMIN: null,
};

export function homePathFor(role: Role): string | null {
  return HOME_PATHS[role];
}
