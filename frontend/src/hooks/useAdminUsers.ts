import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { userListPath, type UserFilters } from "@/lib/admin";
import { EXPORT_PAGE_SIZE, fetchAllPages } from "@/lib/pagination";

type Schemas = components["schemas"];
export type AdminUser = Schemas["UserRead"];
export type ImportResult = Schemas["UserImportResult"];

// Butun kullanici sorgulari bu onekle baslar; ekleme/duzenleme hepsini yeniler
const USERS_KEY = ["admin", "users"];
// Backend'in page_size ust siniri; birim sayaclari ve islem kaydi adlari icin tek istek yeter
const ADMIN_PAGE_SIZE = 200;
// Kullanicilar ekraninda bir sayfa (islem kayitlariyla ayni)
export const USER_PAGE_SIZE = 50;

// Tum liste: Birimler ekranindaki kisi sayilari ve islem kayitlarindaki adlar
export function useAdminUsers() {
  return useQuery({
    queryKey: [...USERS_KEY, "all"],
    queryFn: () => apiGet<Schemas["Page_UserRead_"]>(`/admin/users?page_size=${ADMIN_PAGE_SIZE}`),
    select: (page) => page.items,
  });
}

// Kullanicilar ekrani: arama ve suzgecler sunucuda; sayfa degisirken eski sayfa ekranda kalir
export function useUserSearch(filters: UserFilters, page: number) {
  return useQuery({
    queryKey: [...USERS_KEY, "search", filters, page],
    queryFn: () => apiGet<Schemas["Page_UserRead_"]>(userListPath(filters, page, USER_PAGE_SIZE)),
    placeholderData: keepPreviousData,
  });
}

// Excel'e aktar: ayni suzgece uyan butun kullanicilar
export function fetchAllUsers(filters: UserFilters): Promise<AdminUser[]> {
  return fetchAllPages((page) => userListPath(filters, page, EXPORT_PAGE_SIZE));
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

export interface ImportRequest {
  file: File;
  password: string;
  dryRun: boolean;
}

// Toplu yukleme (docs/API.md "Toplu yukleme"): hepsi ya da hicbiri. dry_run hicbir sey yazmaz; gercek
// yuklemede kimse eklenmediyse (hatali satir) liste yenilenmez
export function useImportUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, password, dryRun }: ImportRequest) => {
      const form = new FormData();
      form.append("file", file);
      form.append("password", password);
      return apiRequest<ImportResult>(`/admin/users/import?dry_run=${dryRun}`, { method: "POST", body: form });
    },
    onSuccess: (result) => {
      if (!result.dry_run && result.created > 0) {
        void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      }
    },
  });
}
