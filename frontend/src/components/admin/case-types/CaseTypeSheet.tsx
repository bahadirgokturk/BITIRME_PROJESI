"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCreateCaseType, useUpdateCaseType } from "@/hooks/useAdminCaseTypes";
import {
  caseTypeFormProblems,
  EMPTY_CASE_TYPE_FORM,
  formFromCaseType,
  toCaseTypeBody,
  type CaseType,
  type CaseTypeForm,
} from "@/lib/adminCaseTypes";

import { ActiveToggle, HistoryLink, SHEET_CLASS } from "../AdminParts";
import { CaseTypeFormFields } from "./CaseTypeFormFields";

export type CaseTypeTarget = { mode: "create" } | { mode: "edit"; caseType: CaseType };

const ACTIVE_NOTE =
  "Pasif tür yeni bildirimlerde önerilmez ve seçilemez. Kayıt silinmez; istediğiniz zaman yeniden aktifleştirebilirsiniz.";
const INACTIVE_NOTE = "Tür yeni bildirimlerde yeniden önerilir ve seçilebilir olur.";

interface CaseTypeSheetProps {
  target: CaseTypeTarget;
  departments: readonly { id: number; name: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}

function StatusSection({ caseType, onDone }: { caseType: CaseType; onDone: (message: string) => void }) {
  const update = useUpdateCaseType(caseType.id);
  const next = !caseType.is_active;
  return (
    <ActiveToggle
      active={caseType.is_active}
      subject="Türü"
      note={caseType.is_active ? ACTIVE_NOTE : INACTIVE_NOTE}
      error={update.error}
      pending={update.isPending}
      onToggle={() =>
        update.mutate(
          { is_active: next },
          { onSuccess: () => onDone(`${caseType.name} ${next ? "aktifleştirildi" : "pasifleştirildi"}.`) },
        )
      }
    />
  );
}

// Yeni tur ML modelinde yoktur (docs/API.md "/admin/case-types"); yonetici ne bekleyecegini eklemeden once gorur
function ModelNote() {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/50 p-4">
      <p className="text-sm font-medium">Yapay zekâ bu türü nasıl tanır?</p>
      <p className="text-[13px] text-muted-foreground">
        Yapay zekâ modeli yalnız eğitildiği türleri tanır. Yeni tür, model yeniden eğitilene kadar anahtar kelimelerle
        bulunur. Türe bir yapay zekâ politikası da kendiliğinden açılır.
      </p>
    </div>
  );
}

// Ekle (POST: kod dahil) ya da duzenle (PATCH: kod haric); ikisi de basarida ayni mesaj kalibini kullanir
function useSaveCaseType(target: CaseTypeTarget, onDone: (message: string) => void) {
  const create = useCreateCaseType();
  const update = useUpdateCaseType(target.mode === "edit" ? target.caseType.id : 0);
  const active = target.mode === "create" ? create : update;
  function save(form: CaseTypeForm) {
    const body = toCaseTypeBody(form);
    const done = (verb: string) => () => onDone(`${body.name} ${verb}.`);
    if (target.mode === "create") {
      create.mutate({ ...body, code: form.code }, { onSuccess: done("eklendi") });
      return;
    }
    update.mutate(body, { onSuccess: done("güncellendi") });
  }
  return { save, error: active.error, isPending: active.isPending };
}

// Ekle/duzenle paneli sagdan acilir (UI_GUIDE bolum 5.5, Figma: 06 Admin > /admin/case-types - duzenleme paneli)
export function CaseTypeSheet({ target, departments, onClose, onDone }: CaseTypeSheetProps) {
  const editing = target.mode === "edit";
  const [form, setForm] = useState(() => (editing ? formFromCaseType(target.caseType) : EMPTY_CASE_TYPE_FORM));
  const [submitted, setSubmitted] = useState(false);
  const saving = useSaveCaseType(target, onDone);
  const problems = submitted ? caseTypeFormProblems(form, target.mode) : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(caseTypeFormProblems(form, target.mode)).length === 0) {
      saving.save(form);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className={SHEET_CLASS}>
        <SheetTitle className="text-lg font-semibold">{editing ? "Türü düzenle" : "Tür ekle"}</SheetTitle>
        <SheetDescription>
          {editing ? target.caseType.name : "Yeni tür, bildirimler sınıflandırılırken kullanılır."}
        </SheetDescription>
        <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
          <CaseTypeFormFields form={form} problems={problems} editing={editing} departments={departments} onChange={setForm} />
          <FormAlert error={saving.error} />
          {editing ? <StatusSection caseType={target.caseType} onDone={onDone} /> : <ModelNote />}
          <div className="mt-auto flex justify-end gap-2 pt-2">
            {editing ? <HistoryLink entity="CASE_TYPE" id={target.caseType.id} /> : null}
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
