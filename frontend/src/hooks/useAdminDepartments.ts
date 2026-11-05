import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type Department = Schemas["DepartmentRead"];

const DEPARTMENTS_KEY = ["admin", "departments"];
// Backend'in page_size ust siniri; birimlerin hepsi tek istekte gelir
const ADMIN_PAGE_SIZE = 200;

export function useAdminDepartments() {
  return useQuery({
    queryKey: DEPARTMENTS_KEY,
    queryFn: () => apiGet<Schemas["Page_DepartmentRead_"]>(`/admin/departments?page_size=${ADMIN_PAGE_SIZE}`),
    select: (page) => page.items,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["DepartmentCreate"]) => apiPost<Department>("/admin/departments", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  });
}

// PATCH yalniz gonderilen alanlari degistirir (docs/API.md "/admin/departments"); kod degistirilemez
export function useUpdateDepartment(departmentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["DepartmentUpdate"]) =>
      apiRequest<Department>(`/admin/departments/${departmentId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  });
}
