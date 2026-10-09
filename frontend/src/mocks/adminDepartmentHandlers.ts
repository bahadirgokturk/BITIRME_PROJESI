// Yonetim > Birimler endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E2-3).
// Tekrar eden kod backend ile ayni mesajla doner (core/messages.py DUPLICATE_CODE).
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { DEPARTMENTS } from "./fixtures";

type Schemas = components["schemas"];
type Department = Schemas["DepartmentRead"];

let departments: Department[] = [];

// Testler her seferinde ayni listeyle baslar
export function resetAdminDepartments(): void {
  departments = structuredClone(DEPARTMENTS);
}
resetAdminDepartments();

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

export const adminDepartmentHandlers = [
  http.get(apiUrl("/admin/departments"), () =>
    HttpResponse.json({ items: departments, total: departments.length, page: 1 }),
  ),

  http.post<never, Schemas["DepartmentCreate"]>(apiUrl("/admin/departments"), async ({ request }) => {
    const body = await request.json();
    if (departments.some((department) => department.code === body.code)) {
      return error(409, "CONFLICT", "Bu kod zaten kullanılıyor.");
    }
    const created: Department = {
      id: Math.max(...departments.map((department) => department.id)) + 1,
      code: body.code,
      name: body.name,
      is_active: true,
    };
    departments.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch<{ id: string }, Schemas["DepartmentUpdate"]>(
    apiUrl("/admin/departments/:id"),
    async ({ request, params }) => {
      const body = await request.json();
      const id = Number(params.id);
      const current = departments.find((department) => department.id === id);
      if (!current) {
        return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
      }
      const updated: Department = {
        ...current,
        name: body.name ?? current.name,
        is_active: body.is_active ?? current.is_active,
      };
      departments = departments.map((department) => (department.id === id ? updated : department));
      return HttpResponse.json(updated);
    },
  ),
];
