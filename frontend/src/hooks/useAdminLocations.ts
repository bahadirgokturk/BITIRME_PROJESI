import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qrFileName, type QrFormat } from "@/lib/adminLocations";
import { apiGet, apiGetBlob, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type Location = Schemas["LocationRead"];

const LOCATIONS_KEY = ["admin", "locations"];
// Backend'in page_size ust siniri
const ADMIN_PAGE_SIZE = 200;

// Agac icin butun konumlar gerekir; kampus 200'den fazla konum icerebilir, sayfalar sirayla toplanir
async function fetchAllLocations(): Promise<Location[]> {
  const items: Location[] = [];
  for (let page = 1; ; page += 1) {
    const result = await apiGet<Schemas["Page_LocationRead_"]>(
      `/admin/locations?page=${page}&page_size=${ADMIN_PAGE_SIZE}`,
    );
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) {
      return items;
    }
  }
}

export function useAdminLocations() {
  return useQuery({ queryKey: LOCATIONS_KEY, queryFn: fetchAllLocations });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["LocationCreate"]) => apiPost<Location>("/admin/locations", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOCATIONS_KEY }),
  });
}

// PATCH yalniz gonderilen alanlari degistirir (docs/API.md "/admin/locations"); tur ve kod degistirilemez
export function useUpdateLocation(locationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["LocationUpdate"]) =>
      apiRequest<Location>(`/admin/locations/${locationId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOCATIONS_KEY }),
  });
}

const qrPath = (id: number, format: QrFormat) => `/admin/locations/${id}/qr?format=${format}`;

// QR onizlemesi: dosya yetki ister, <img src> dogrudan kullanilamaz; Bearer ile alinip gecici adrese cevrilir
export function useLocationQrPreview(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [...LOCATIONS_KEY, id, "qr"],
    queryFn: async () => URL.createObjectURL(await apiGetBlob(qrPath(id, "svg"))),
    enabled,
    staleTime: Infinity,
  });
}

// Kapiya asilacak dosyayi indirir: gecici adres, indirme adli bir baglanti uzerinden tiklanir ve birakilir
export function useDownloadLocationQr(location: Pick<Location, "id" | "code">) {
  return useMutation({
    mutationFn: async (format: QrFormat) => {
      const url = URL.createObjectURL(await apiGetBlob(qrPath(location.id, format)));
      const link = document.createElement("a");
      link.href = url;
      link.download = qrFileName(location, format);
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}
