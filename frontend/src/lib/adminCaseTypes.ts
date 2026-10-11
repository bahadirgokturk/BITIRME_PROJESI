// Yonetim > Bildirim Turleri kurallari (docs/UI_GUIDE.md bolum 5.5, docs/API.md "/admin/case-types").
// Alan kurallari backend ile ayni; burada denetlemek formu sunucuya gitmeden aciklar, son karar backend'in.
import { matchesStatus, type FormMode, type StatusFilter } from "@/lib/admin";
import { normalizeCode } from "@/lib/adminDepartments";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type CaseType = Schemas["CaseTypeAdminRead"];
export type CaseCategory = Schemas["CaseCategory"];
export type Priority = Schemas["Priority"];

const LOCALE = "tr-TR";
// backend/app/schemas/catalog.py ve core/constants.py ile ayni sinirlar
const CODE_PATTERN = /^[A-Z0-9_]+$/;
const SEVERITY_MIN = 0;
const SEVERITY_MAX = 100;
const KEYWORD_MAX_LENGTH = 50;
const WHOLE_NUMBER = /^\d+$/;
const KEYWORD_SEPARATOR = /[,\n]/;

export interface CaseTypeFilters {
  search: string;
  category: CaseCategory | null;
  status: StatusFilter;
}

export const NO_CASE_TYPE_FILTERS: CaseTypeFilters = { search: "", category: null, status: "all" };

const lower = (text: string) => text.toLocaleLowerCase(LOCALE);

// Liste API'de aranmiyor (yalniz sayfalama); turler az, hepsi tek istekte gelir. Ad ve anahtar kelimeler
// Turkce kurallarla, kod ise kod bicimine cevrilerek aranir ("lost item" yazinca "LOST_ITEM" bulunur).
export function filterCaseTypes(types: readonly CaseType[], filters: CaseTypeFilters): CaseType[] {
  const text = filters.search.trim();
  const query = lower(text);
  const codeQuery = normalizeCode(text);
  return types.filter(
    (type) =>
      (filters.category === null || type.category === filters.category) &&
      matchesStatus(filters.status, type.is_active) &&
      (lower(`${type.name} ${type.keywords.join(" ")}`).includes(query) || type.code.includes(codeQuery)),
  );
}

// Kural tabanli siniflandirma kucuk harfle eslestirir; tekrar eden kelime bir kez gonderilir
export function parseKeywords(text: string): string[] {
  const words = text.split(KEYWORD_SEPARATOR).map((word) => lower(word.trim()));
  return [...new Set(words.filter((word) => word !== ""))];
}

export interface CaseTypeForm {
  name: string;
  code: string;
  category: CaseCategory | "";
  // Secim kutulari metin tutar; bos metin "birim yok" demektir
  default_department_id: string;
  secondary_department_id: string;
  base_priority: Priority;
  base_severity: string;
  is_safety_related: boolean;
  keywords: string;
}

export const EMPTY_CASE_TYPE_FORM: CaseTypeForm = {
  name: "",
  code: "",
  category: "",
  default_department_id: "",
  secondary_department_id: "",
  base_priority: "MEDIUM",
  base_severity: "50",
  is_safety_related: false,
  keywords: "",
};

const idText = (id: number | null) => (id === null ? "" : String(id));

export function formFromCaseType(type: CaseType): CaseTypeForm {
  return {
    name: type.name,
    code: type.code,
    category: type.category,
    default_department_id: idText(type.default_department_id),
    secondary_department_id: idText(type.secondary_department_id),
    base_priority: type.base_priority,
    base_severity: String(type.base_severity),
    is_safety_related: type.is_safety_related,
    keywords: type.keywords.join(", "),
  };
}

export type CaseTypeFormProblems = Partial<Record<keyof CaseTypeForm, string>>;

function codeProblem(code: string): string | null {
  if (code === "") {
    return "Kod yazmalısınız.";
  }
  return CODE_PATTERN.test(code) ? null : "Kod yalnız büyük harf (A-Z), rakam ve alt çizgi içerebilir.";
}

function validSeverity(text: string): boolean {
  const value = Number(text);
  return WHOLE_NUMBER.test(text) && value >= SEVERITY_MIN && value <= SEVERITY_MAX;
}

// Kod yalniz eklerken denetlenir: sonradan degistirilemez (CaseTypeUpdate'te kod alani yok)
export function caseTypeFormProblems(form: CaseTypeForm, mode: FormMode): CaseTypeFormProblems {
  const code = mode === "create" ? codeProblem(form.code) : null;
  const longKeyword = parseKeywords(form.keywords).some((word) => word.length > KEYWORD_MAX_LENGTH);
  const checks: [keyof CaseTypeForm, boolean, string][] = [
    ["name", form.name.trim() === "", "Tür adı yazmalısınız."],
    ["code", code !== null, code ?? ""],
    ["category", form.category === "", "Kategori seçmelisiniz."],
    ["base_severity", !validSeverity(form.base_severity.trim()), "Ciddiyet 0 ile 100 arasında bir tam sayı olmalı."],
    ["keywords", longKeyword, `Her anahtar kelime en çok ${KEYWORD_MAX_LENGTH} karakter olabilir.`],
  ];
  return Object.fromEntries(checks.filter(([, failed]) => failed).map(([field, , message]) => [field, message]));
}

const departmentId = (text: string) => (text === "" ? null : Number(text));

// Ekleme ve guncellemede ortak alanlar. Birim alanlari null ile kaldirilir (docs/API.md "/admin/case-types").
// Yalniz denetimden gecmis formla cagrilir: kategori secilmistir.
export function toCaseTypeBody(form: CaseTypeForm) {
  return {
    name: form.name.trim(),
    category: form.category as CaseCategory,
    default_department_id: departmentId(form.default_department_id),
    secondary_department_id: departmentId(form.secondary_department_id),
    base_priority: form.base_priority,
    base_severity: Number(form.base_severity.trim()),
    is_safety_related: form.is_safety_related,
    keywords: parseKeywords(form.keywords),
  };
}

export const NO_DEPARTMENT_LABEL = "Birim yok";

export function departmentLabel(id: number | null, departments: readonly { id: number; name: string }[] | undefined): string {
  if (id === null) {
    return NO_DEPARTMENT_LABEL;
  }
  return departments?.find((department) => department.id === id)?.name ?? "–";
}

interface DepartmentChoice {
  id: number;
  name: string;
  is_active: boolean;
}

// Pasif birim yeni atamada secilemez; turun zaten bagli oldugu pasif birim listede kalir (yoksa secim bos gorunur)
export function selectableDepartments<T extends DepartmentChoice>(departments: readonly T[], current: CaseType | null): T[] {
  const linked = [current?.default_department_id, current?.secondary_department_id];
  return departments.filter((department) => department.is_active || linked.includes(department.id));
}
