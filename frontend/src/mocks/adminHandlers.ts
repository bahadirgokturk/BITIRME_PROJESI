// Yonetim > Kullanicilar endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E2-3).
// Rol kurallari, tekil e-posta ve kendini kilitleme backend ile ayni mesajlarla doner (core/messages.py).
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { USERS } from "./fixtures";

type Schemas = components["schemas"];
type UserRead = Schemas["UserRead"];
type Role = Schemas["UserRole"];

// Pasif bir personel: tabloda "Pasif" durumunu gostermek icin
const INACTIVE_STAFF: UserRead = {
  id: 9,
  email: "ali.personel@example.edu.tr",
  full_name: "Ali Çelik",
  role: "STAFF",
  reporter_kind: null,
  department_id: 3,
  is_active: false,
  must_change_password: false,
  last_login_at: null,
  created_at: "2026-09-01T08:00:00Z",
};

let users: UserRead[] = [];

// Testler her seferinde ayni listeyle baslar
export function resetAdminUsers(): void {
  users = structuredClone([...Object.values(USERS), INACTIVE_STAFF]);
}
resetAdminUsers();

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

const INVALID_ROLE = () =>
  error(
    422,
    "INVALID_USER_ROLE",
    "Rol bilgileri tutarsız: bildirim yapanlarda kullanıcı türü, personel ve müdürlerde birim zorunludur.",
  );
const DUPLICATE_EMAIL = () => error(409, "CONFLICT", "Bu e-posta adresi zaten kayıtlı.");
const SELF_LOCKOUT = () =>
  error(409, "SELF_LOCKOUT", "Kendi hesabınızı pasifleştiremez ya da yönetici rolünüzü kaldıramazsınız.");

function roleIsConsistent(user: Pick<UserRead, "role" | "reporter_kind" | "department_id">): boolean {
  if (user.role === "REPORTER") {
    return user.reporter_kind !== null;
  }
  const needsDepartment = user.role === "STAFF" || user.role === "MANAGER";
  return user.reporter_kind === null && (!needsDepartment || user.department_id !== null);
}

function emailTaken(email: string, exceptId?: number): boolean {
  return users.some((user) => user.email === email.toLowerCase() && user.id !== exceptId);
}

// Sahte oturum her zaman USERS.ADMIN: kendi hesabini kilitleyemez
function locksOutSelf(id: number, body: Schemas["UserUpdate"]): boolean {
  return id === USERS.ADMIN.id && (body.is_active === false || (body.role != null && body.role !== "ADMIN"));
}

const LOCALE = "tr-TR";
// backend/app/schemas/user.py parola alt siniri
const PASSWORD_MIN = 8;

// q ad soyad ya da e-postada Turkce harf ve buyuk/kucuk harf duyarsiz aranir
function matchesQuery(user: UserRead, params: URLSearchParams): boolean {
  const q = (params.get("q") ?? "").toLocaleLowerCase(LOCALE);
  const role = params.get("role");
  const department = params.get("department_id");
  const active = params.get("is_active");
  return (
    `${user.full_name} ${user.email}`.toLocaleLowerCase(LOCALE).includes(q) &&
    (role === null || user.role === role) &&
    (department === null || user.department_id === Number(department)) &&
    (active === null || String(user.is_active) === active)
  );
}

interface ImportRow {
  email: string;
  full_name: string;
  role: Role;
  reporter_kind: Schemas["ReporterKind"] | null;
}

// Yalniz virgullu basit dosya; satir numarasi Excel'deki gibi (baslik 1. satir)
function parseImport(text: string): { rows: ImportRow[]; errors: Schemas["ImportRowError"][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const rows: ImportRow[] = [];
  const errors: Schemas["ImportRowError"][] = [];
  lines.slice(1).forEach((line, index) => {
    const [email = "", full_name = "", role = "", kind = ""] = line.split(",").map((cell) => cell.trim());
    if (!email.includes("@")) {
      errors.push({ row: index + 2, message: "Geçersiz e-posta adresi." });
      return;
    }
    if (emailTaken(email)) {
      errors.push({ row: index + 2, message: "Bu e-posta adresi zaten kayıtlı." });
      return;
    }
    rows.push({ email, full_name, role: role as Role, reporter_kind: (kind || null) as ImportRow["reporter_kind"] });
  });
  return { rows, errors };
}

function importedUser(row: ImportRow, index: number): UserRead {
  return {
    id: Math.max(...users.map((user) => user.id)) + 1 + index,
    ...row,
    email: row.email.toLowerCase(),
    department_id: null,
    is_active: true,
    must_change_password: true,
    last_login_at: null,
    created_at: new Date().toISOString(),
  };
}

export const adminHandlers = [
  // Backend gibi: suzgecler birlikte, sonra sayfa; total suzulmus sayidir
  http.get(apiUrl("/admin/users"), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? "1");
    const size = Number(params.get("page_size") ?? "50");
    const matching = users.filter((user) => matchesQuery(user, params));
    const items = matching.slice((page - 1) * size, page * size);
    return HttpResponse.json({ items, total: matching.length, page });
  }),

  // Toplu yukleme: hepsi ya da hicbiri; dry_run hicbir sey yazmaz (docs/API.md "Toplu yukleme")
  http.post(apiUrl("/admin/users/import"), async ({ request }) => {
    const dryRun = new URL(request.url).searchParams.get("dry_run") === "true";
    const form = await request.formData();
    const file = form.get("file");
    // FormData degeri metin ya da dosyadir; test ortaminda File sinifi farkli olabilir, instanceof kullanilmaz
    if (file === null || typeof file === "string" || String(form.get("password") ?? "").length < PASSWORD_MIN) {
      return error(422, "VALIDATION_ERROR", "Dosya ve en az 8 karakterlik geçici parola gerekli.");
    }
    const { rows, errors } = parseImport(await file.text());
    const result: Schemas["UserImportResult"] = { created: errors.length ? 0 : rows.length, errors, dry_run: dryRun };
    if (!dryRun && errors.length === 0) {
      users.push(...rows.map((row, index) => importedUser(row, index)));
    }
    return HttpResponse.json(result);
  }),

  http.post<never, Schemas["UserCreate"]>(apiUrl("/admin/users"), async ({ request }) => {
    const body = await request.json();
    const created: UserRead = {
      id: Math.max(...users.map((user) => user.id)) + 1,
      email: body.email.toLowerCase(),
      full_name: body.full_name,
      role: body.role,
      reporter_kind: body.reporter_kind ?? null,
      department_id: body.department_id ?? null,
      is_active: true,
      must_change_password: false,
      last_login_at: null,
      created_at: new Date().toISOString(),
    };
    if (emailTaken(created.email)) {
      return DUPLICATE_EMAIL();
    }
    if (!roleIsConsistent(created)) {
      return INVALID_ROLE();
    }
    users.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  // Gecici parola: kullanici ilk giriste kendi parolasini belirler; yonetici kendininkini buradan sifirlayamaz
  http.post<{ id: string }, Schemas["PasswordReset"]>(apiUrl("/admin/users/:id/password"), ({ params }) => {
    const id = Number(params.id);
    const current = users.find((user) => user.id === id);
    if (!current) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    if (id === USERS.ADMIN.id) {
      return error(409, "SELF_LOCKOUT", "Kendi parolanızı buradan sıfırlayamazsınız; profilinizden değiştirin.");
    }
    const updated: UserRead = { ...current, must_change_password: true };
    users = users.map((user) => (user.id === id ? updated : user));
    return HttpResponse.json(updated);
  }),

  http.patch<{ id: string }, Schemas["UserUpdate"]>(apiUrl("/admin/users/:id"), async ({ request, params }) => {
    const body = await request.json();
    const id = Number(params.id);
    const current = users.find((user) => user.id === id);
    if (!current) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    if (locksOutSelf(id, body)) {
      return SELF_LOCKOUT();
    }
    const fields = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
    const updated: UserRead = { ...current, ...fields };
    if (!roleIsConsistent(updated)) {
      return INVALID_ROLE();
    }
    users = users.map((user) => (user.id === id ? updated : user));
    return HttpResponse.json(updated);
  }),
];
