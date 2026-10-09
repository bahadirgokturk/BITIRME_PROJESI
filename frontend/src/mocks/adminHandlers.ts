// Yonetim > Kullanicilar endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E2-3).
// Rol kurallari, tekil e-posta ve kendini kilitleme backend ile ayni mesajlarla doner (core/messages.py).
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { USERS } from "./fixtures";

type Schemas = components["schemas"];
type UserRead = Schemas["UserRead"];

// Pasif bir personel: tabloda "Pasif" durumunu gostermek icin
const INACTIVE_STAFF: UserRead = {
  id: 9,
  email: "ali.personel@example.edu.tr",
  full_name: "Ali Çelik",
  role: "STAFF",
  reporter_kind: null,
  department_id: 3,
  is_active: false,
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

export const adminHandlers = [
  http.get(apiUrl("/admin/users"), () => HttpResponse.json({ items: users, total: users.length, page: 1 })),

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
