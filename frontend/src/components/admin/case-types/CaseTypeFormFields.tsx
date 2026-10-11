import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CaseTypeForm, CaseTypeFormProblems } from "@/lib/adminCaseTypes";
import { normalizeCode } from "@/lib/adminDepartments";
import { CATEGORY_LABELS } from "@/lib/reports";
import { PRIORITY_LABELS } from "@/lib/tasks";

import { Choice, Field } from "../Field";

const CODE_HINT = "Büyük harf, rakam ve alt çizgi. Örnek: ELEVATOR_FAILURE. Sonradan değiştirilemez.";
// 0-100 arasi en cok uc hane
const SEVERITY_MAX_DIGITS = 3;
const SAFETY_ID = "case-type-safety";

interface FieldsProps {
  form: CaseTypeForm;
  problems: CaseTypeFormProblems;
  editing: boolean;
  departments: readonly { id: number; name: string }[];
  onChange: (form: CaseTypeForm) => void;
}

type PartProps = Pick<FieldsProps, "form" | "problems" | "departments"> & {
  set: (fields: Partial<CaseTypeForm>) => void;
};

// Bos secim "birim yok" demektir: gorev acilmaz, mudur karar verir
function RoutingFields({ form, departments, set }: PartProps) {
  const options = departments.map((department): [string, string] => [String(department.id), department.name]);
  return (
    <>
      <Field label="Görevi alan birim" hint="Bu türdeki bildirimlerin görevi bu birime açılır.">
        {(c) => (
          <Choice
            control={c}
            value={form.default_department_id}
            options={options}
            placeholder="Birim yok (müdür karar verir)"
            onChange={(value) => set({ default_department_id: value })}
          />
        )}
      </Field>
      <Field label="Bilgilendirilen birim" hint="Yalnız haber verilir; görev bu birime açılmaz.">
        {(c) => (
          <Choice
            control={c}
            value={form.secondary_department_id}
            options={options}
            placeholder="Yok"
            onChange={(value) => set({ secondary_department_id: value })}
          />
        )}
      </Field>
    </>
  );
}

function SafetyCheckbox({ form, set }: Pick<PartProps, "form" | "set">) {
  return (
    <>
      <div className="flex items-start gap-2.5">
        <input
          id={SAFETY_ID}
          type="checkbox"
          checked={form.is_safety_related}
          onChange={(event) => set({ is_safety_related: event.target.checked })}
          aria-describedby={`${SAFETY_ID}-note`}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <div>
          <label htmlFor={SAFETY_ID} className="block cursor-pointer text-sm font-medium">
            Güvenlikle ilgili
          </label>
          <p id={`${SAFETY_ID}-note`} className="text-xs text-muted-foreground">
            Can ya da mal güvenliğini etkileyen türlerde işaretleyin.
          </p>
        </div>
      </div>
    </>
  );
}

function SeverityFields({ form, problems, set }: PartProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Başlangıç önceliği">
          {(c) => (
            <Choice
              control={c}
              value={form.base_priority}
              options={Object.entries(PRIORITY_LABELS)}
              onChange={(value) => set({ base_priority: value as CaseTypeForm["base_priority"] })}
            />
          )}
        </Field>
        <Field label="Ciddiyet (0–100)" error={problems.base_severity}>
          {(c) => (
            <Input
              {...c}
              inputMode="numeric"
              maxLength={SEVERITY_MAX_DIGITS}
              value={form.base_severity}
              onChange={(event) => set({ base_severity: event.target.value })}
              className="h-11"
            />
          )}
        </Field>
      </div>
      <SafetyCheckbox form={form} set={set} />
    </>
  );
}

// Kod yalniz eklerken yazilir; duzenlerken kilitlidir
function IdentityFields({ form, problems, set, editing }: PartProps & { editing: boolean }) {
  return (
    <>
      <Field label="Tür adı" error={problems.name}>
        {(c) => <Input {...c} value={form.name} onChange={(event) => set({ name: event.target.value })} className="h-11" />}
      </Field>
      <Field label="Kod" error={problems.code} hint={editing ? "Kod sonradan değiştirilemez." : CODE_HINT}>
        {(c) => (
          <Input
            {...c}
            value={form.code}
            readOnly={editing}
            autoCapitalize="characters"
            onChange={(event) => set({ code: normalizeCode(event.target.value) })}
            className={editing ? "h-11 bg-muted" : "h-11"}
          />
        )}
      </Field>
      <Field label="Kategori" error={problems.category}>
        {(c) => (
          <Choice
            control={c}
            value={form.category}
            options={Object.entries(CATEGORY_LABELS)}
            placeholder="Kategori seçin"
            onChange={(value) => set({ category: value as CaseTypeForm["category"] })}
          />
        )}
      </Field>
    </>
  );
}

function KeywordsField({ form, problems, set }: PartProps) {
  return (
    <Field
      label="Anahtar kelimeler"
      error={problems.keywords}
      hint="Virgülle ayırın. Yapay zekâ bu kelimeleri görünce bu türü önerir."
    >
      {(c) => (
        <Textarea
          {...c}
          value={form.keywords}
          onChange={(event) => set({ keywords: event.target.value })}
          className="min-h-20 text-base"
        />
      )}
    </Field>
  );
}

// Bildirim turu formu (Figma: 06 Admin > /admin/case-types - duzenleme paneli); kod yalniz eklerken yazilir
export function CaseTypeFormFields({ form, problems, editing, departments, onChange }: FieldsProps) {
  const set = (fields: Partial<CaseTypeForm>) => onChange({ ...form, ...fields });
  const part = { form, problems, departments, set };
  return (
    <>
      <IdentityFields {...part} editing={editing} />
      <RoutingFields {...part} />
      <SeverityFields {...part} />
      <KeywordsField {...part} />
    </>
  );
}
