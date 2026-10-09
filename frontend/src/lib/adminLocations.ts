// Yonetim > Konumlar kurallari (docs/UI_GUIDE.md bolum 5.5, docs/API.md "/admin/locations").
// Alan kurallari backend ile ayni; burada denetlemek formu sunucuya gitmeden aciklar, son karar backend'in.
import { matchesStatus, type FormMode, type StatusFilter } from "@/lib/admin";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type AdminLocation = Schemas["LocationRead"];
export type LocationKind = Schemas["LocationKind"];

const LOCALE = "tr-TR";

export const KIND_LABELS: Record<LocationKind, string> = {
  CAMPUS: "Kampüs",
  BUILDING: "Bina",
  FLOOR: "Kat",
  ROOM: "Oda",
  WC: "Tuvalet",
  CORRIDOR: "Koridor",
  OUTDOOR: "Açık alan",
  OTHER: "Diğer",
};

export interface LocationRow {
  location: AdminLocation;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

function childrenByParent(locations: readonly AdminLocation[]): Map<number | null, AdminLocation[]> {
  const children = new Map<number | null, AdminLocation[]>();
  for (const location of locations) {
    children.set(location.parent_id, [...(children.get(location.parent_id) ?? []), location]);
  }
  return children;
}

// Agacin gorunen satirlari: bir konumun alti yalniz kendisi acikken listelenir.
// Kardeslerin sirasi listedeki siradir (backend path'e gore siralar).
export function locationRows(locations: readonly AdminLocation[], expanded: ReadonlySet<number>): LocationRow[] {
  const children = childrenByParent(locations);
  const rows: LocationRow[] = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const location of children.get(parentId) ?? []) {
      const open = expanded.has(location.id);
      rows.push({ location, depth, hasChildren: children.has(location.id), expanded: open });
      if (open) {
        visit(location.id, depth + 1);
      }
    }
  };
  visit(null, 0);
  return rows;
}

// Ekran ilk acildiginda en ust duzey (kampus) aciktir: binalar gorunur, alt katlar kapali
export function rootIds(locations: readonly AdminLocation[]): Set<number> {
  return new Set(locations.filter((location) => location.parent_id === null).map((location) => location.id));
}

// Konumun ust konumlarinin adlari, en ustten baslayarak; en ust duzeyde bos metin
export function locationTrail(location: AdminLocation, locations: readonly AdminLocation[]): string {
  const byId = new Map(locations.map((item) => [item.id, item]));
  const names: string[] = [];
  let parent = location.parent_id === null ? undefined : byId.get(location.parent_id);
  while (parent) {
    names.unshift(parent.name);
    parent = parent.parent_id === null ? undefined : byId.get(parent.parent_id);
  }
  return names.join(" › ");
}

export interface LocationFilters {
  search: string;
  status: StatusFilter;
}

export const NO_LOCATION_FILTERS: LocationFilters = { search: "", status: "all" };

export function isFiltered(filters: LocationFilters): boolean {
  return filters.search.trim() !== "" || filters.status !== "all";
}

// Aramada noktali ve noktasiz i ayni sayilir: kodlar (IT-1) Turkce kucuk harfe cevrilince noktasiz kalir
function fold(text: string): string {
  return text.toLocaleLowerCase(LOCALE).replaceAll("ı", "i");
}

// Ad, kod ve diger adlarda arar; sonuc duz listedir (agac degil)
export function filterLocations(locations: readonly AdminLocation[], filters: LocationFilters): AdminLocation[] {
  const query = fold(filters.search.trim());
  return locations.filter(
    (location) =>
      matchesStatus(filters.status, location.is_active) &&
      fold([location.name, location.code, ...location.aliases].join(" ")).includes(query),
  );
}

export interface ParentOption {
  id: number;
  label: string;
}

// Secim kutusunda derinlik girintiyle gosterilir (bolunmeyen bosluk: tarayici normal boslugu yutar)
const INDENT = "   ";

// Ust konum secenekleri, agac sirasinda. Tasirken konumun kendisi ve alti secilemez (422 INVALID_PARENT).
export function parentOptions(locations: readonly AdminLocation[], moving: AdminLocation | null): ParentOption[] {
  const everything = new Set(locations.map((location) => location.id));
  const blocked = moving ? `${moving.path}/` : null;
  return locationRows(locations, everything)
    .filter(({ location }) => location.id !== moving?.id && !(blocked && location.path.startsWith(blocked)))
    .map(({ location, depth }) => ({ id: location.id, label: INDENT.repeat(depth) + location.name }));
}

export interface LocationForm {
  name: string;
  kind: LocationKind;
  code: string;
  // Secim kutusu degeri; bos = en ust duzey
  parent_id: string;
  importance: string;
  // Virgulle ayrilmis diger adlar
  aliases: string;
}

// backend/app/core/constants.py: lokasyon onemi 0-100, yeni lokasyonda notr deger 50
const IMPORTANCE_MIN = 0;
const IMPORTANCE_MAX = 100;
const DEFAULT_IMPORTANCE = 50;

export const EMPTY_LOCATION_FORM: LocationForm = {
  name: "",
  kind: "ROOM",
  code: "",
  parent_id: "",
  importance: String(DEFAULT_IMPORTANCE),
  aliases: "",
};

export function formFromLocation(location: AdminLocation): LocationForm {
  return {
    name: location.name,
    kind: location.kind,
    code: location.code,
    parent_id: location.parent_id === null ? "" : String(location.parent_id),
    importance: String(location.importance_weight),
    aliases: location.aliases.join(", "),
  };
}

export function parseAliases(text: string): string[] {
  return text
    .split(",")
    .map((alias) => alias.trim())
    .filter((alias) => alias !== "");
}

export type LocationFormProblems = Partial<Record<keyof LocationForm, string>>;

// "/" path ayiricisidir (KMP/B/B-2); kodda kullanilamaz
function codeProblem(code: string): string | null {
  if (code.trim() === "") {
    return "Kod yazmalısınız.";
  }
  return code.includes("/") ? "Kodda eğik çizgi (/) kullanılamaz." : null;
}

function importanceIsValid(text: string): boolean {
  const value = Number(text);
  return /^\d+$/.test(text.trim()) && value >= IMPORTANCE_MIN && value <= IMPORTANCE_MAX;
}

// Kod yalniz eklerken denetlenir: tur ve kod sonradan degistirilemez (LocationUpdate'te yoklar)
export function locationFormProblems(form: LocationForm, mode: FormMode): LocationFormProblems {
  const problems: LocationFormProblems = {};
  if (form.name.trim() === "") {
    problems.name = "Konum adı yazmalısınız.";
  }
  const code = mode === "create" ? codeProblem(form.code) : null;
  if (code) {
    problems.code = code;
  }
  if (!importanceIsValid(form.importance)) {
    problems.importance = `Önem ${IMPORTANCE_MIN} ile ${IMPORTANCE_MAX} arasında bir tam sayı olmalı.`;
  }
  return problems;
}

function parentIdOf(form: LocationForm): number | null {
  return form.parent_id === "" ? null : Number(form.parent_id);
}

export function toCreateBody(form: LocationForm): Schemas["LocationCreate"] {
  return {
    name: form.name.trim(),
    kind: form.kind,
    code: form.code.trim(),
    parent_id: parentIdOf(form),
    importance_weight: Number(form.importance),
    aliases: parseAliases(form.aliases),
  };
}

// parent_id yalniz konum tasindiysa gonderilir: PATCH'te "parent_id: null" konumu en uste tasir
export function toUpdateBody(form: LocationForm, original: AdminLocation): Schemas["LocationUpdate"] {
  const body: Schemas["LocationUpdate"] = {
    name: form.name.trim(),
    importance_weight: Number(form.importance),
    aliases: parseAliases(form.aliases),
  };
  const parentId = parentIdOf(form);
  return parentId === original.parent_id ? body : { ...body, parent_id: parentId };
}
