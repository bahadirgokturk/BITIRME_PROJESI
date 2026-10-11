// Yonetim > Sure Hedefleri kurallari (docs/UI_GUIDE.md bolum 5.5, docs/API.md "/admin/sla-rules").
// Alan kurallari backend ile ayni; burada denetlemek formu sunucuya gitmeden aciklar, son karar backend'in.
import { matchesStatus, type FormMode, type StatusFilter } from "@/lib/admin";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type SlaRule = Schemas["SlaRuleRead"];
export type Priority = Schemas["Priority"];

const LOCALE = "tr-TR";
// Turu bos kural: o oncelikte, ture ozel kurali olmayan butun bildirimler
export const DEFAULT_RULE_LABEL = "Varsayılan (tüm türler)";
const UNKNOWN_TYPE = "–";
// Varsayilan kurallar en az acilden en acile dizilir (Figma: tablonun ilk dort satiri)
const PRIORITY_ORDER: readonly Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export type DurationUnit = "minute" | "hour" | "day";

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const UNIT_MINUTES: Record<DurationUnit, number> = {
  minute: 1,
  hour: MINUTES_PER_HOUR,
  day: MINUTES_PER_HOUR * HOURS_PER_DAY,
};
export const UNIT_LABELS: Record<DurationUnit, string> = { minute: "dakika", hour: "saat", day: "gün" };
// Buyukten kucuge: gosterimde ve birim seciminde once en buyuk birim denenir
const UNITS_LARGE_FIRST: readonly DurationUnit[] = ["day", "hour", "minute"];
const SHORT_LABELS: Record<DurationUnit, string> = { day: "gün", hour: "saat", minute: "dk" };

// 240 -> "4 saat", 90 -> "1 saat 30 dk": dakika sayisi okunmasi kolay birimlerle yazilir
export function formatDuration(minutes: number): string {
  let rest = minutes;
  const parts: string[] = [];
  for (const unit of UNITS_LARGE_FIRST) {
    const count = Math.floor(rest / UNIT_MINUTES[unit]);
    rest -= count * UNIT_MINUTES[unit];
    if (count > 0) {
      parts.push(`${count} ${SHORT_LABELS[unit]}`);
    }
  }
  return parts.join(" ");
}

// Formda sure, sayi + birim olarak yazilir; tam bolunen en buyuk birim secilir (2880 dk -> 2 gun)
export function splitDuration(minutes: number): { amount: string; unit: DurationUnit } {
  const unit = UNITS_LARGE_FIRST.find((candidate) => minutes % UNIT_MINUTES[candidate] === 0) ?? "minute";
  return { amount: String(minutes / UNIT_MINUTES[unit]), unit };
}

const WHOLE_NUMBER = /^\d+$/;

// Gecersiz sayi (bos, sifir, kesirli) null doner
export function toMinutes(amount: string, unit: DurationUnit): number | null {
  const text = amount.trim();
  const value = Number(text);
  return WHOLE_NUMBER.test(text) && value > 0 ? value * UNIT_MINUTES[unit] : null;
}

interface TypeName {
  id: number;
  name: string;
  code: string;
}

export interface SlaRuleRow {
  rule: SlaRule;
  typeName: string;
  // Varsayilan kuralda kod yoktur
  typeCode: string | null;
}

function toRow(rule: SlaRule, types: readonly TypeName[] | undefined): SlaRuleRow {
  if (rule.case_type_id === null) {
    return { rule, typeName: DEFAULT_RULE_LABEL, typeCode: null };
  }
  const type = types?.find((candidate) => candidate.id === rule.case_type_id);
  return { rule, typeName: type?.name ?? UNKNOWN_TYPE, typeCode: type?.code ?? null };
}

const priorityRank = (row: SlaRuleRow) => PRIORITY_ORDER.indexOf(row.rule.priority);

// Once varsayilan kurallar, sonra ture ozel kurallar tur adina gore; ayni turde oncelik sirasi
export function slaRuleRows(rules: readonly SlaRule[], types: readonly TypeName[] | undefined): SlaRuleRow[] {
  const isDefault = (row: SlaRuleRow) => (row.rule.case_type_id === null ? 0 : 1);
  return rules
    .map((rule) => toRow(rule, types))
    .sort(
      (a, b) =>
        isDefault(a) - isDefault(b) ||
        (isDefault(a) === 1 ? a.typeName.localeCompare(b.typeName, LOCALE) : 0) ||
        priorityRank(a) - priorityRank(b),
    );
}

export interface SlaRuleFilters {
  search: string;
  priority: Priority | null;
  status: StatusFilter;
}

export const NO_SLA_RULE_FILTERS: SlaRuleFilters = { search: "", priority: null, status: "all" };

export function filterSlaRules(rows: readonly SlaRuleRow[], filters: SlaRuleFilters): SlaRuleRow[] {
  const query = filters.search.trim().toLocaleLowerCase(LOCALE);
  return rows.filter(
    (row) =>
      (filters.priority === null || row.rule.priority === filters.priority) &&
      matchesStatus(filters.status, row.rule.is_active) &&
      row.typeName.toLocaleLowerCase(LOCALE).includes(query),
  );
}

export interface SlaRuleForm {
  // Bos metin: varsayilan kural (tur yok)
  case_type_id: string;
  priority: Priority | "";
  response_amount: string;
  response_unit: DurationUnit;
  resolution_amount: string;
  resolution_unit: DurationUnit;
  warning_pct: string;
}

// backend/app/core/constants.py SLA_WARNING_PCT_DEFAULT ve sinirlari (1-99)
const WARNING_DEFAULT = "75";
const WARNING_MIN = 1;
const WARNING_MAX = 99;

export const EMPTY_SLA_RULE_FORM: SlaRuleForm = {
  case_type_id: "",
  priority: "",
  response_amount: "",
  response_unit: "minute",
  resolution_amount: "",
  resolution_unit: "hour",
  warning_pct: WARNING_DEFAULT,
};

export function formFromSlaRule(rule: SlaRule): SlaRuleForm {
  const response = splitDuration(rule.response_minutes);
  const resolution = splitDuration(rule.resolution_minutes);
  return {
    case_type_id: rule.case_type_id === null ? "" : String(rule.case_type_id),
    priority: rule.priority,
    response_amount: response.amount,
    response_unit: response.unit,
    resolution_amount: resolution.amount,
    resolution_unit: resolution.unit,
    warning_pct: String(rule.warning_threshold_pct),
  };
}

export type SlaRuleFormProblems = Partial<Record<keyof SlaRuleForm, string>>;

const typeId = (form: SlaRuleForm) => (form.case_type_id === "" ? null : Number(form.case_type_id));

function validWarning(text: string): boolean {
  const value = Number(text);
  return WHOLE_NUMBER.test(text) && value >= WARNING_MIN && value <= WARNING_MAX;
}

// Tur + oncelik basina tek kural vardir; pasif olan da sayilir (backend 409 doner, eskisi aktiflestirilir)
function duplicateProblem(form: SlaRuleForm, rules: readonly SlaRule[]): string | null {
  const existing = rules.find((rule) => rule.case_type_id === typeId(form) && rule.priority === form.priority);
  if (!existing) {
    return null;
  }
  return existing.is_active
    ? "Bu tür ve öncelik için zaten bir kural var."
    : "Bu tür ve öncelik için pasif bir kural var; onu düzenleyip aktifleştirin.";
}

function priorityProblem(form: SlaRuleForm, mode: FormMode, rules: readonly SlaRule[]): string | null {
  if (mode === "edit") {
    return null;
  }
  return form.priority === "" ? "Öncelik seçmelisiniz." : duplicateProblem(form, rules);
}

const BAD_DURATION = "Süreyi 1 ya da daha büyük bir tam sayı olarak yazmalısınız.";

function resolutionProblem(response: number | null, resolution: number | null): string | null {
  if (resolution === null) {
    return BAD_DURATION;
  }
  return response !== null && resolution < response ? "Çözüm hedefi kabul hedefinden kısa olamaz." : null;
}

// Hedef (tur, oncelik) yalniz eklerken denetlenir: sonradan degistirilemez
export function slaRuleFormProblems(form: SlaRuleForm, mode: FormMode, rules: readonly SlaRule[]): SlaRuleFormProblems {
  const response = toMinutes(form.response_amount, form.response_unit);
  const resolution = toMinutes(form.resolution_amount, form.resolution_unit);
  const checks: [keyof SlaRuleForm, string | null][] = [
    ["priority", priorityProblem(form, mode, rules)],
    ["response_amount", response === null ? BAD_DURATION : null],
    ["resolution_amount", resolutionProblem(response, resolution)],
    ["warning_pct", validWarning(form.warning_pct.trim()) ? null : "Uyarı eşiği 1 ile 99 arasında bir tam sayı olmalı."],
  ];
  return Object.fromEntries(checks.filter(([, message]) => message !== null));
}

// Asagidaki iki fonksiyon yalniz denetimden gecmis formla cagrilir: sureler ve oncelik gecerlidir
export function toSlaRuleUpdate(form: SlaRuleForm) {
  return {
    response_minutes: toMinutes(form.response_amount, form.response_unit) as number,
    resolution_minutes: toMinutes(form.resolution_amount, form.resolution_unit) as number,
    warning_threshold_pct: Number(form.warning_pct.trim()),
  };
}

export function toSlaRuleCreate(form: SlaRuleForm) {
  return { case_type_id: typeId(form), priority: form.priority as Priority, ...toSlaRuleUpdate(form) };
}
