// Yonetim > Konumlar endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E2-3).
// Path sunucudaki gibi hesaplanir (KMP/B/B-2); tekrar eden kod ve gecersiz tasima backend mesajlariyla doner.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { LOCATIONS } from "./fixtures";

type Schemas = components["schemas"];
type Location = Schemas["LocationRead"];

// Pasif bir konum: listede "Pasif" durumunu gostermek icin
const INACTIVE_OUTDOOR: Location = {
  id: 6,
  parent_id: 1,
  kind: "OUTDOOR",
  code: "OTOPARK-A",
  name: "A Blok Otoparkı",
  path: "KMP/OTOPARK-A",
  importance_weight: 30,
  aliases: ["otopark"],
  is_active: false,
};

let locations: Location[] = [];

// Testler her seferinde ayni listeyle baslar
export function resetAdminLocations(): void {
  locations = structuredClone([...LOCATIONS, INACTIVE_OUTDOOR]);
}
resetAdminLocations();

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

function pathUnder(parentId: number | null, code: string): string {
  const parent = locations.find((location) => location.id === parentId);
  return parent ? `${parent.path}/${code}` : code;
}

// Liste agac sirasinda (path'e gore) doner
function sorted(): Location[] {
  return [...locations].sort((a, b) => a.path.localeCompare(b.path));
}

// Tasinan konumun altindakilerin path'i de yeni on eke gecer
function move(current: Location, parentId: number | null): void {
  const oldPrefix = current.path;
  const newPrefix = pathUnder(parentId, current.code);
  locations = locations.map((location) =>
    location.path === oldPrefix || location.path.startsWith(`${oldPrefix}/`)
      ? { ...location, path: newPrefix + location.path.slice(oldPrefix.length) }
      : location,
  );
}

function isInvalidParent(current: Location, parentId: number | null): boolean {
  const parent = locations.find((location) => location.id === parentId);
  return parent !== undefined && (parent.id === current.id || parent.path.startsWith(`${current.path}/`));
}

export const adminLocationHandlers = [
  http.get(apiUrl("/admin/locations"), () =>
    HttpResponse.json({ items: sorted(), total: locations.length, page: 1 }),
  ),

  http.post<never, Schemas["LocationCreate"]>(apiUrl("/admin/locations"), async ({ request }) => {
    const body = await request.json();
    if (locations.some((location) => location.code === body.code)) {
      return error(409, "CONFLICT", "Bu kod zaten kullanılıyor.");
    }
    const created: Location = {
      id: Math.max(...locations.map((location) => location.id)) + 1,
      parent_id: body.parent_id ?? null,
      kind: body.kind,
      code: body.code,
      name: body.name,
      path: pathUnder(body.parent_id ?? null, body.code),
      importance_weight: body.importance_weight ?? 50,
      aliases: body.aliases ?? [],
      is_active: true,
    };
    locations.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch<{ id: string }, Schemas["LocationUpdate"]>(apiUrl("/admin/locations/:id"), async ({ request, params }) => {
    const body = await request.json();
    const id = Number(params.id);
    const current = locations.find((location) => location.id === id);
    if (!current) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    if (body.parent_id !== undefined && isInvalidParent(current, body.parent_id)) {
      return error(422, "INVALID_PARENT", "Lokasyon kendisinin ya da kendi alt lokasyonunun altına taşınamaz.");
    }
    if (body.parent_id !== undefined) {
      move(current, body.parent_id);
    }
    const { parent_id, ...rest } = body;
    const fields = Object.fromEntries(Object.entries(rest).filter(([, value]) => value != null));
    locations = locations.map((location) =>
      location.id === id ? { ...location, ...fields, ...(parent_id === undefined ? {} : { parent_id }) } : location,
    );
    return HttpResponse.json(locations.find((location) => location.id === id));
  }),
];
