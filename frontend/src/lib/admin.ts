// Yonetim > Kullanicilar kurallari (docs/UI_GUIDE.md bolum 5.5, docs/API.md "/admin/users").
// Rol kurallari backend ile ayni; burada denetlemek formu sunucuya gitmeden aciklar, son karar backend'in.
import type { components } from "@/lib/api/types";
import { REPORTER_KIND_LABELS } from "@/lib/shell";

type Schemas = components["schemas"];
type UserRead = Schemas["UserRead"];
export type Role = Schemas["UserRole"];
export type ReporterKind = Schemas["ReporterKind"];

const LOCALE = "tr-TR";

export type StatusFilter = "all" | "active" | "inactive";

export interface UserFilters {
  search: string;
  role: Role | null;
  status: StatusFilter;
}

const STATUS_MATCH: Record<StatusFilter, (user: UserRead) => boolean> = {
  all: () => true,
  active: (user) => user.is_active,
  inactive: (user) => !user.is_active,
};

// Liste API'de aranmiyor (yalniz sayfalama); kampus olceginde tum kullanicilar tek istekte gelir
export function filterUsers(users: readonly UserRead[], filters: UserFilters): UserRead[] {
  const query = filters.search.trim().toLocaleLowerCase(LOCALE);
  return users.filter(
    (user) =>
      (filters.role === null || user.role === filters.role) &&
      STATUS_MATCH[filters.status](user) &&
      `${user.full_name} ${user.email}`.toLocaleLowerCase(LOCALE).includes(query),
  );
}

// Tabloda "Birim / tur": bildirim yapanin turu, personelin ve mudurun birimi
export function userAssignment(user: UserRead, departments: readonly { id: number; name: string }[]): string {
  if (user.reporter_kind) {
    return REPORTER_KIND_LABELS[user.reporter_kind];
  }
  return departments.find((department) => department.id === user.department_id)?.name ?? "–";
}

export interface UserForm {
  full_name: string;
  email: string;
  role: Role;
  reporter_kind: ReporterKind | "";
  department_id: string;
  password: string;
}

export type FormMode = "create" | "edit";
export type UserFormProblems = Partial<Record<keyof UserForm, string>>;

// Backend kurallari (422 INVALID_USER_ROLE): STAFF/MANAGER birim ister, REPORTER kullanici turu ister
const NEEDS_DEPARTMENT: readonly Role[] = ["STAFF", "MANAGER"];
// backend/app/schemas/user.py parola alt siniri
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export function userFormProblems(form: UserForm, mode: FormMode): UserFormProblems {
  const checks: [keyof UserForm, boolean, string][] = [
    ["full_name", form.full_name.trim() === "", "Ad soyad yazmalısınız."],
    ["email", !EMAIL_PATTERN.test(form.email.trim()), "Geçerli bir e-posta yazmalısınız."],
    ["reporter_kind", form.role === "REPORTER" && form.reporter_kind === "", "Kullanıcı türü seçmelisiniz."],
    ["department_id", NEEDS_DEPARTMENT.includes(form.role) && form.department_id === "", "Birim seçmelisiniz."],
    ["password", mode === "create" && form.password.length < PASSWORD_MIN_LENGTH, "Parola en az 8 karakter olmalı."],
  ];
  return Object.fromEntries(checks.filter(([, failed]) => failed).map(([field, , message]) => [field, message]));
}

export function needsDepartment(role: Role): boolean {
  return NEEDS_DEPARTMENT.includes(role);
}

// Role ait olmayan alanlar bos gonderilir (backend rol degisince eski reporter_kind'i zaten siler)
export function toUserBody(form: UserForm) {
  return {
    full_name: form.full_name.trim(),
    email: form.email.trim(),
    role: form.role,
    reporter_kind: form.role === "REPORTER" && form.reporter_kind !== "" ? form.reporter_kind : null,
    department_id: needsDepartment(form.role) ? Number(form.department_id) : null,
  };
}

export const EMPTY_USER_FORM: UserForm = {
  full_name: "",
  email: "",
  role: "REPORTER",
  reporter_kind: "",
  department_id: "",
  password: "",
};

export function formFromUser(user: UserRead): UserForm {
  return {
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    reporter_kind: user.reporter_kind ?? "",
    department_id: user.department_id === null ? "" : String(user.department_id),
    password: "",
  };
}
