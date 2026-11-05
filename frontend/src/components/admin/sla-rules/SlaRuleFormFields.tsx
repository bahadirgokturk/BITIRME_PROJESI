import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_RULE_LABEL,
  UNIT_LABELS,
  type DurationUnit,
  type SlaRuleForm,
  type SlaRuleFormProblems,
} from "@/lib/adminSlaRules";
import { PRIORITY_LABELS } from "@/lib/tasks";

import { Choice, Field } from "../Field";

const DEFAULT_HINT = "Varsayılan kural, türe özel kuralı olmayan bildirimlerde geçerlidir.";
const TARGET_HINT = "Tür ve öncelik sonradan değiştirilemez.";
// En uzun hedef gun olarak yazilir; bes hane fazlasiyla yeter
const AMOUNT_MAX_DIGITS = 5;
const PERCENT_MAX_DIGITS = 2;
const UNIT_OPTIONS = Object.entries(UNIT_LABELS).reverse();

interface FieldsProps {
  form: SlaRuleForm;
  problems: SlaRuleFormProblems;
  editing: boolean;
  caseTypes: readonly { id: number; name: string }[];
  onChange: (form: SlaRuleForm) => void;
}

interface DurationProps {
  label: string;
  hint: string;
  amount: string;
  unit: DurationUnit;
  error?: string;
  onChange: (amount: string, unit: DurationUnit) => void;
}

// Sure sayi + birim olarak yazilir ("4" + "saat"); dakika hesabi lib/adminSlaRules.ts'te.
// Aciklama iki kutunun altinda tam genislikte durur (Figma: DurationField).
function DurationField({ label, hint, amount, unit, error, onChange }: DurationProps) {
  const unitId = useId();
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 items-start gap-3">
        <Field label={label} error={error}>
          {(c) => (
            <Input
              {...c}
              inputMode="numeric"
              maxLength={AMOUNT_MAX_DIGITS}
              value={amount}
              onChange={(event) => onChange(event.target.value, unit)}
              className="h-11"
            />
          )}
        </Field>
        <div className="space-y-1.5">
          <Label htmlFor={unitId}>Birim</Label>
          <Choice
            control={{ id: unitId }}
            ariaLabel={`${label} birimi`}
            value={unit}
            options={UNIT_OPTIONS}
            onChange={(value) => onChange(amount, value as DurationUnit)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

type PartProps = Pick<FieldsProps, "form" | "problems"> & { set: (fields: Partial<SlaRuleForm>) => void };

function TargetFields({ form, problems, set, editing, caseTypes }: PartProps & Pick<FieldsProps, "editing" | "caseTypes">) {
  const typeOptions = caseTypes.map((type): [string, string] => [String(type.id), type.name]);
  return (
    <>
      <Field label="Tür" hint={editing ? undefined : DEFAULT_HINT}>
        {(c) => (
          <Choice
            control={c}
            value={form.case_type_id}
            options={typeOptions}
            placeholder={DEFAULT_RULE_LABEL}
            disabled={editing}
            onChange={(value) => set({ case_type_id: value })}
          />
        )}
      </Field>
      <Field label="Öncelik" error={problems.priority} hint={TARGET_HINT}>
        {(c) => (
          <Choice
            control={c}
            value={form.priority}
            options={Object.entries(PRIORITY_LABELS)}
            placeholder="Öncelik seçin"
            disabled={editing}
            onChange={(value) => set({ priority: value as SlaRuleForm["priority"] })}
          />
        )}
      </Field>
    </>
  );
}

// Sure hedefi formu (Figma: 06 Admin > /admin/sla-rules - duzenleme paneli); hedef yalniz eklerken secilir
export function SlaRuleFormFields({ form, problems, editing, caseTypes, onChange }: FieldsProps) {
  const set = (fields: Partial<SlaRuleForm>) => onChange({ ...form, ...fields });
  return (
    <>
      <TargetFields form={form} problems={problems} set={set} editing={editing} caseTypes={caseTypes} />
      <DurationField
        label="Kabul hedefi"
        hint="Görevin personelce kabul edilmesi için tanınan süre."
        amount={form.response_amount}
        unit={form.response_unit}
        error={problems.response_amount}
        onChange={(response_amount, response_unit) => set({ response_amount, response_unit })}
      />
      <DurationField
        label="Çözüm hedefi"
        hint="Bildirimin çözülmesi için tanınan süre. Kabul hedefinden kısa olamaz."
        amount={form.resolution_amount}
        unit={form.resolution_unit}
        error={problems.resolution_amount}
        onChange={(resolution_amount, resolution_unit) => set({ resolution_amount, resolution_unit })}
      />
      <Field label="Uyarı eşiği (%)" error={problems.warning_pct} hint="Sürenin yüzde kaçı dolunca “Riskte” uyarısı verilir (1–99).">
        {(c) => (
          <Input
            {...c}
            inputMode="numeric"
            maxLength={PERCENT_MAX_DIGITS}
            value={form.warning_pct}
            onChange={(event) => set({ warning_pct: event.target.value })}
            className="h-11"
          />
        )}
      </Field>
    </>
  );
}
