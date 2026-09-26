// Rol bazli menu tablosu; yetki matrisi: docs/WORKFLOW.md bolum 4
// Rol kontrolu bilesenlerde if ile degil bu tabloyla yapilir (KOD_KURALLARI kural 2)
// FAZ 2'de UserRole OpenAPI semasina girince Role tipi oradan uretilecek (ADR-7)
export const ROLES = ["REPORTER", "STAFF", "MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export interface NavItem {
  href: string;
  label: string;
}

const REPORT: NavItem = { href: "/report", label: "Bildirim Yap" };
const MANAGEMENT_VIEWS: NavItem[] = [
  { href: "/manager/dashboard", label: "Dashboard" },
  { href: "/manager/analytics", label: "Analitik" },
  { href: "/manager/agents", label: "Agent'lar" },
];

const NAVIGATION: Record<Role, NavItem[]> = {
  REPORTER: [REPORT, { href: "/my-cases", label: "Bildirimlerim" }],
  STAFF: [REPORT, { href: "/staff/tasks", label: "Görevlerim" }],
  MANAGER: [REPORT, ...MANAGEMENT_VIEWS, { href: "/manager/cases", label: "Case'ler" }],
  ADMIN: [REPORT, ...MANAGEMENT_VIEWS, { href: "/admin", label: "Yönetim" }],
};

export function navigationFor(role: Role): NavItem[] {
  return NAVIGATION[role];
}
