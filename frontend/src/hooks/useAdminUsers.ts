import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type AdminUser = Schemas["UserRead"];

const USERS_KEY = ["admin", "users"];
// Backend'in page_size ust siniri; kampus olceginde tum kullanicilar tek istekte gelir
const ADMIN_PAGE_SIZE = 200;

export function useAdminUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => apiGet<Schemas["Page_UserRead_"]>(`/admin/users?page_size=${ADMIN_PAGE_SIZE}`),
    select: (page) => page.items,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["UserCreate"]) => apiPost<AdminUser>("/admin/users", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

// PATCH yalniz gonderilen alanlari degistirir (docs/API.md "/admin/users")
export function useUpdateUser(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["UserUpdate"]) =>
      apiRequest<AdminUser>(`/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
