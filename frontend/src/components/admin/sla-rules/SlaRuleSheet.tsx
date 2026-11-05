"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCreateSlaRule, useUpdateSlaRule } from "@/hooks/useAdminSlaRules";
import {
  DEFAULT_RULE_LABEL,
  EMPTY_SLA_RULE_FORM,
  formFromSlaRule,
  slaRuleFormProblems,
  toSlaRuleCreate,
  toSlaRuleUpdate,
  type SlaRule,
  type SlaRuleForm,
  type SlaRuleRow,
} from "@/lib/adminSlaRules";
import { PRIORITY_LABELS } from "@/lib/tasks";

import { ActiveToggle, HistoryLink, SHEET_CLASS } from "../AdminParts";
import { SlaRuleFormFields } from "./SlaRuleFormFields";

export type SlaRuleTarget = { mode: "create" } | { mode: "edit"; row: SlaRuleRow };

type CaseTypes = readonly { id: number; name: string }[];

const ACTIVE_NOTE =
  "Pasif kural yeni atamalarda kullanılmaz. Kayıt silinmez; istediğiniz zaman yeniden aktifleştirebilirsiniz.";
const INACTIVE_NOTE = "Kural yeni atamalarda yeniden kullanılır.";

interface SlaRuleSheetProps {
  target: SlaRuleTarget;
  // Ayni hedefe ikinci kural acilmasin diye butun kurallar (pasifler dahil)
  rules: readonly SlaRule[];
  caseTypes: CaseTypes;
  onClose: () => void;
  onDone: (message: string) => void;
}

// Onay notundaki ad: tur adi, oncelik ve "kurali" sozcugu
function ruleName(form: SlaRuleForm, caseTypes: CaseTypes): string {
  const type = caseTypes.find((candidate) => String(candidate.id) === form.case_type_id)?.name ?? DEFAULT_RULE_LABEL;
  const priority = form.priority === "" ? "" : PRIORITY_LABELS[form.priority];
  return `${type} · ${priority} kuralı`;
}

function StatusSection({ rule, name, onDone }: { rule: SlaRule; name: string; onDone: (message: string) => void }) {
  const update = useUpdateSlaRule(rule.id);
  const next = !rule.is_active;
  return (
    <ActiveToggle
      active={rule.is_active}
      subject="Kuralı"
      note={rule.is_active ? ACTIVE_NOTE : INACTIVE_NOTE}
      error={update.error}
      pending={update.isPending}
      onToggle={() =>
        update.mutate(
          { is_active: next },
          { onSuccess: () => onDone(`${name} ${next ? "aktifleştirildi" : "pasifleştirildi"}.`) },
        )
      }
    />
  );
}

// Ekle (POST: hedef dahil) ya da duzenle (PATCH: yalniz sureler ve esik)
function useSaveSlaRule(target: SlaRuleTarget, onDone: (message: string) => void) {
  const create = useCreateSlaRule();
  const update = useUpdateSlaRule(target.mode === "edit" ? target.row.rule.id : 0);
  const active = target.mode === "create" ? create : update;
  function save(form: SlaRuleForm, name: string) {
    if (target.mode === "create") {
      create.mutate(toSlaRuleCreate(form), { onSuccess: () => onDone(`${name} eklendi.`) });
      return;
    }
    update.mutate(toSlaRuleUpdate(form), { onSuccess: () => onDone(`${name} güncellendi.`) });
  }
  return { save, error: active.error, isPending: active.isPending };
}

// Ekle/duzenle paneli sagdan acilir (UI_GUIDE bolum 5.5, Figma: 06 Admin > /admin/sla-rules - duzenleme paneli)
export function SlaRuleSheet({ target, rules, caseTypes, onClose, onDone }: SlaRuleSheetProps) {
  const editing = target.mode === "edit";
  const [form, setForm] = useState(() => (editing ? formFromSlaRule(target.row.rule) : EMPTY_SLA_RULE_FORM));
  const [submitted, setSubmitted] = useState(false);
  const saving = useSaveSlaRule(target, onDone);
  const problems = submitted ? slaRuleFormProblems(form, target.mode, rules) : {};
  const name = ruleName(form, caseTypes);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(slaRuleFormProblems(form, target.mode, rules)).length === 0) {
      saving.save(form, name);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className={SHEET_CLASS}>
        <SheetTitle className="text-lg font-semibold">{editing ? "Kuralı düzenle" : "Kural ekle"}</SheetTitle>
        <SheetDescription>
          {editing ? name.replace(" kuralı", "") : "Bir tür ve öncelik için kabul ve çözüm süresi belirleyin."}
        </SheetDescription>
        <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
          <SlaRuleFormFields form={form} problems={problems} editing={editing} caseTypes={caseTypes} onChange={setForm} />
          <p className="text-xs text-muted-foreground">
            Yeni süreler yeni atamalarda kullanılır; hedefi hesaplanmış bildirimler değişmez.
          </p>
          <FormAlert error={saving.error} />
          {editing ? <StatusSection rule={target.row.rule} name={name} onDone={onDone} /> : null}
          <div className="mt-auto flex justify-end gap-2 pt-2">
            {editing ? <HistoryLink entity="SLA_RULE" id={target.row.rule.id} /> : null}
            <SheetClose render={<Button type="button" variant="outline" className="h-11 px-4" />}>Vazgeç</SheetClose>
            <Button type="submit" className="h-11 px-4" disabled={saving.isPending}>
              {saving.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
