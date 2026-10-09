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

// Menu adlari duz Turkce: memurlar "dashboard", "agent", "case" gibi terimleri bilmeyebilir (UI_GUIDE bolum 6)
const REPORT: NavItem = { href: "/report", label: "Bildirim Yap" };
const DASHBOARD: NavItem = { href: "/manager/dashboard", label: "Genel Bakış" };
const INSIGHTS: NavItem[] = [
  { href: "/manager/analytics", label: "Raporlar" },
  { href: "/manager/agents", label: "Yapay Zekâ Performansı" },
];
const MANAGEMENT_VIEWS: NavItem[] = [DASHBOARD, ...INSIGHTS];

const NAVIGATION: Record<Role, NavItem[]> = {
  REPORTER: [REPORT, { href: "/my-cases", label: "Bildirimlerim", subPaths: ["/cases"] }],
  STAFF: [REPORT, { href: "/staff/tasks", label: "Görevlerim" }],
  // Inceleme kuyrugu yalniz MANAGER'da: AI'in emin olamadigi bildirimlere birim muduru karar verir (UI_GUIDE 5.4)
  MANAGER: [
    REPORT,
    DASHBOARD,
    { href: "/manager/review-queue", label: "İnceleme Kuyruğu" },
    ...INSIGHTS,
    { href: "/manager/cases", label: "Tüm Bildirimler" },
  ],
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

// Giristen sonra acilan sayfa: her rol kendi ilk ekranina gider (yonetici: Yonetim).
// Adres o rolun menusunde olmak zorunda (navigation.test.ts).
const HOME_PATHS: Record<Role, string> = {
  REPORTER: "/my-cases",
  STAFF: "/staff/tasks",
  MANAGER: DASHBOARD.href,
  ADMIN: "/admin",
};

export function homePathFor(role: Role): string {
  return HOME_PATHS[role];
}

// Yonetim bolumunun sekmeleri (docs/UI_GUIDE.md bolum 5.5); yeni bolum eklenince buraya satir eklenir
export const ADMIN_SECTIONS: readonly NavItem[] = [
  { href: "/admin/users", label: "Kullanıcılar" },
  { href: "/admin/departments", label: "Birimler" },
  { href: "/admin/locations", label: "Konumlar" },
];
