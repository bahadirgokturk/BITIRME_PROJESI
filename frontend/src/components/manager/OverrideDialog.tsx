"use client";

import { useState } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Label } from "@/components/ui/label";
import { useCaseTypes, useDepartments, useReviewAction, type ReviewItem } from "@/hooks/useReview";
import type { components } from "@/lib/api/types";
import { currentOverrideValue, OVERRIDE_FIELD_LABELS, PRIORITY_LABELS, type OverrideField } from "@/lib/review";

import { ReasonDialog } from "./ReasonDialog";

type Schemas = components["schemas"];

interface Option {
  value: string;
  label: string;
}

const SELECT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

const PRIORITY_OPTIONS: Option[] = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }));

// Secilen alanin secenekleri: oncelik sabit, tur ve birim sozluk endpoint'lerinden (yalniz gerektiginde)
function useOptions(field: OverrideField) {
  const caseTypes = useCaseTypes(field === "case_type");
  const departments = useDepartments(field === "department");
  if (field === "priority") {
    return { options: PRIORITY_OPTIONS, loading: false, error: null };
  }
  const query = field === "case_type" ? caseTypes : departments;
  const options = (query.data ?? []).map((item) => ({ value: item.code, label: item.name }));
  return { options, loading: query.isPending, error: query.error };
}

interface FieldsProps {
  field: OverrideField;
  value: string;
  onField: (field: OverrideField) => void;
  onValue: (value: string) => void;
}

// Pencere icerigi yalniz acikken cizilir: sozlukler pencere acilinca istenir
function OverrideFields({ field, value, onField, onValue }: FieldsProps) {
  const { options, loading, error } = useOptions(field);
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="override-field">Düzeltilecek alan</Label>
        <select
          id="override-field"
          value={field}
          onChange={(event) => onField(event.target.value as OverrideField)}
          className={SELECT_CLASS}
        >
          {Object.entries(OVERRIDE_FIELD_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="override-value">Yeni değer</Label>
        <select
          id="override-value"
          value={value}
          onChange={(event) => onValue(event.target.value)}
          disabled={loading}
          className={SELECT_CLASS}
        >
          <option value="">{loading ? "Yükleniyor…" : "Seçin"}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <FormAlert error={error} />
    </>
  );
}

// AI onerisini duzelt (tur, oncelik, birim): gerekce zorunlu, decision_feedback'e yazilir ve
// modelin yeniden egitiminde kullanilir (docs/API.md "override")
export function OverrideDialog({ item, onDone }: { item: ReviewItem; onDone: (message: string) => void }) {
  const override = useReviewAction<Schemas["OverrideRequest"]>(item.case.id, "override");
  const [field, setField] = useState<OverrideField>("case_type");
  const [value, setValue] = useState(() => currentOverrideValue(item.case, "case_type"));

  function chooseField(next: OverrideField) {
    setField(next);
    setValue(currentOverrideValue(item.case, next));
  }

  return (
    <ReasonDialog
      trigger="Düzelt"
      title="AI önerisini düzelt"
      description={`${item.case.case_number} · ${item.case.title}. Düzeltmen modelin yeniden eğitiminde kullanılır.`}
      confirm="Düzeltmeyi kaydet"
      mutation={override}
      toBody={(reason): Schemas["OverrideRequest"] => ({ field, corrected_value: value, reason })}
      onDone={() => onDone(`${item.case.case_number} düzeltildi.`)}
      canSubmit={value !== ""}
      extra={<OverrideFields field={field} value={value} onField={chooseField} onValue={setValue} />}
    />
  );
}
