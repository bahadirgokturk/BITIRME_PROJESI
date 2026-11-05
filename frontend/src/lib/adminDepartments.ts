// Yonetim > Birimler kurallari (docs/UI_GUIDE.md bolum 5.5, docs/API.md "/admin/departments").
// Alan kurallari backend ile ayni; burada denetlemek formu sunucuya gitmeden aciklar, son karar backend'in.
import { matchesStatus, type FormMode, type StatusFilter } from "@/lib/admin";
import type { components } from "@/lib/api/types";

export type Department = components["schemas"]["DepartmentRead"];

const LOCALE = "tr-TR";

export interface DepartmentFilters {
  search: string;
  status: StatusFilter;
}

export const NO_DEPARTMENT_FILTERS: DepartmentFilters = { search: "", status: "all" };

// Liste API'de aranmiyor (yalniz sayfalama); birim sayisi az, hepsi tek istekte gelir.
// Ad Turkce kurallarla, kod ise kod bicimine cevrilerek aranir ("it" yazinca "IT_SUPPORT" bulunur;
// Turkce kucuk harfe cevirmek "I" harfini noktasiz yapar ve kodu kacirir).
export function filterDepartments(departments: readonly Department[], filters: DepartmentFilters): Department[] {
  const text = filters.search.trim();
  const nameQuery = text.toLocaleLowerCase(LOCALE);
  const codeQuery = normalizeCode(text);
  return departments.filter(
    (department) =>
      matchesStatus(filters.status, department.is_active) &&
      (department.name.toLocaleLowerCase(LOCALE).includes(nameQuery) || department.code.includes(codeQuery)),
  );
}

interface Member {
  department_id: number | null;
  is_active: boolean;
}

// Birim basina aktif kullanici sayisi: pasiflestirmeden once kimlerin etkilenecegini gosterir
export function memberCounts(users: readonly Member[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const user of users) {
    if (user.department_id !== null && user.is_active) {
      counts.set(user.department_id, (counts.get(user.department_id) ?? 0) + 1);
    }
  }
  return counts;
}

export function memberLabel(count: number | undefined): string {
  return count ? `${count} kullanıcı` : "Kullanıcı yok";
}

export interface DepartmentForm {
  name: string;
  code: string;
}

export const EMPTY_DEPARTMENT_FORM: DepartmentForm = { name: "", code: "" };

// backend/app/schemas/department.py: kod yalniz A-Z, 0-9 ve alt cizgi
const CODE_PATTERN = /^[A-Z0-9_]+$/;
const TURKISH_TO_ASCII: Record<string, string> = { Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };

// Yazilan metni kod bicimine cevirir: buyuk harf, Turkce harf yerine ASCII, bosluk ve tire yerine alt cizgi
export function normalizeCode(text: string): string {
  return text
    .toLocaleUpperCase(LOCALE)
    .replace(/[ÇĞİÖŞÜ]/g, (letter) => TURKISH_TO_ASCII[letter] ?? letter)
    .replace(/[\s-]+/g, "_");
}

export type DepartmentFormProblems = Partial<Record<keyof DepartmentForm, string>>;

function codeProblem(code: string): string | null {
  if (code === "") {
    return "Kod yazmalısınız.";
  }
  return CODE_PATTERN.test(code) ? null : "Kod yalnız büyük harf (A-Z), rakam ve alt çizgi içerebilir.";
}

// Kod yalniz eklerken denetlenir: sonradan degistirilemez (DepartmentUpdate'te kod alani yok)
export function departmentFormProblems(form: DepartmentForm, mode: FormMode): DepartmentFormProblems {
  const problems: DepartmentFormProblems = {};
  if (form.name.trim() === "") {
    problems.name = "Birim adı yazmalısınız.";
  }
  const code = mode === "create" ? codeProblem(form.code) : null;
  if (code) {
    problems.code = code;
  }
  return problems;
}
