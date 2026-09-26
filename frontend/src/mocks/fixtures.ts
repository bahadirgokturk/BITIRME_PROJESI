// Sahte API verisi. Tipler backend OpenAPI semasindan gelir; sema degisirse burasi derlenmez.
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type Role = Schemas["UserRole"];

const CREATED_AT = "2026-09-01T09:00:00Z";

export const DEPARTMENTS: Schemas["DepartmentRead"][] = [
  { id: 1, code: "CLEANING", name: "Temizlik", is_active: true },
  { id: 2, code: "TECHNICAL", name: "Teknik İşler", is_active: true },
  { id: 3, code: "IT", name: "Bilgi İşlem", is_active: true },
  { id: 4, code: "SECURITY", name: "Güvenlik", is_active: true },
];

export const USERS: Record<Role, Schemas["UserRead"]> = {
  REPORTER: {
    id: 1,
    email: "ayse.ogrenci@example.edu.tr",
    full_name: "Ayşe Yılmaz",
    role: "REPORTER",
    reporter_kind: "STUDENT",
    department_id: null,
    is_active: true,
    last_login_at: null,
    created_at: CREATED_AT,
  },
  STAFF: {
    id: 2,
    email: "mehmet.temizlik@example.edu.tr",
    full_name: "Mehmet Demir",
    role: "STAFF",
    reporter_kind: null,
    department_id: 1,
    is_active: true,
    last_login_at: CREATED_AT,
    created_at: CREATED_AT,
  },
  MANAGER: {
    id: 3,
    email: "zeynep.mudur@example.edu.tr",
    full_name: "Zeynep Kaya",
    role: "MANAGER",
    reporter_kind: null,
    department_id: 1,
    is_active: true,
    last_login_at: CREATED_AT,
    created_at: CREATED_AT,
  },
  ADMIN: {
    id: 4,
    email: "admin@example.edu.tr",
    full_name: "Sistem Yöneticisi",
    role: "ADMIN",
    reporter_kind: null,
    department_id: null,
    is_active: true,
    last_login_at: CREATED_AT,
    created_at: CREATED_AT,
  },
};

export const LOCATIONS: Schemas["LocationRead"][] = [
  {
    id: 1,
    parent_id: null,
    kind: "CAMPUS",
    code: "KMP",
    name: "Merkez Kampüs",
    path: "KMP",
    importance_weight: 50,
    aliases: [],
    is_active: true,
  },
  {
    id: 2,
    parent_id: 1,
    kind: "BUILDING",
    code: "B",
    name: "B Blok",
    path: "KMP/B",
    importance_weight: 60,
    aliases: ["b blok"],
    is_active: true,
  },
  {
    id: 3,
    parent_id: 2,
    kind: "FLOOR",
    code: "B-2",
    name: "B Blok 2. Kat",
    path: "KMP/B/B-2",
    importance_weight: 50,
    aliases: ["b2"],
    is_active: true,
  },
  {
    id: 4,
    parent_id: 3,
    kind: "WC",
    code: "B-2-WCM",
    name: "B Blok 2. Kat Erkek WC",
    path: "KMP/B/B-2/B-2-WCM",
    importance_weight: 40,
    aliases: ["b blok erkek tuvalet", "b2 wc"],
    is_active: true,
  },
  {
    id: 5,
    parent_id: 3,
    kind: "ROOM",
    code: "B-201",
    name: "B201 Amfi",
    path: "KMP/B/B-2/B-201",
    importance_weight: 90,
    aliases: ["b201", "amfi"],
    is_active: true,
  },
];

// Sahte giriste tum kullanicilar icin ortak parola (yalniz gelistirme)
export const MOCK_PASSWORD = "demo1234";
