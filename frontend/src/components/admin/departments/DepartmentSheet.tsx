"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCreateDepartment, useUpdateDepartment } from "@/hooks/useAdminDepartments";
import {
  departmentFormProblems,
  EMPTY_DEPARTMENT_FORM,
  normalizeCode,
  type Department,
  type DepartmentForm,
  type DepartmentFormProblems,
} from "@/lib/adminDepartments";

import { ActiveToggle } from "../AdminParts";
import { Field } from "../Field";

export type DepartmentTarget = { mode: "create" } | { mode: "edit"; department: Department };

const CODE_HINT = "Büyük harf, rakam ve alt çizgi. Örnek: KUTUPHANE. Sonradan değiştirilemez.";
const ACTIVE_NOTE =
  "Pasif birim, kullanıcı eklerken ve bildirim atarken seçilemez. Kayıt silinmez; istediğiniz zaman yeniden aktifleştirebilirsiniz.";
const INACTIVE_NOTE = "Birim, kullanıcı eklerken ve bildirim atarken yeniden seçilebilir olur.";

interface DepartmentSheetProps {
  target: DepartmentTarget;
  onClose: () => void;
  onDone: (message: string) => void;
}

function StatusSection({ department, onDone }: { department: Department; onDone: (message: string) => void }) {
  const update = useUpdateDepartment(department.id);
  const next = !department.is_active;
  return (
    <ActiveToggle
      active={department.is_active}
      subject="Birimi"
      note={department.is_active ? ACTIVE_NOTE : INACTIVE_NOTE}
      error={update.error}
      pending={update.isPending}
      onToggle={() =>
        update.mutate(
          { is_active: next },
          { onSuccess: () => onDone(`${department.name} ${next ? "aktifleştirildi" : "pasifleştirildi"}.`) },
        )
      }
    />
  );
}

// Ekle (POST: ad + kod) ya da duzenle (PATCH: yalniz ad); ikisi de basarida ayni mesaj kalibini kullanir
function useSaveDepartment(target: DepartmentTarget, onDone: (message: string) => void) {
  const create = useCreateDepartment();
  const update = useUpdateDepartment(target.mode === "edit" ? target.department.id : 0);
  const active = target.mode === "create" ? create : update;
  function save(form: DepartmentForm) {
    const name = form.name.trim();
    const done = (verb: string) => () => onDone(`${name} ${verb}.`);
    if (target.mode === "create") {
      create.mutate({ name, code: form.code }, { onSuccess: done("eklendi") });
      return;
    }
    update.mutate({ name }, { onSuccess: done("güncellendi") });
  }
  return { save, error: active.error, isPending: active.isPending };
}

interface FieldsProps {
  form: DepartmentForm;
  problems: DepartmentFormProblems;
  editing: boolean;
  onChange: (form: DepartmentForm) => void;
}

function DepartmentFields({ form, problems, editing, onChange }: FieldsProps) {
  return (
    <>
      <Field label="Birim adı" error={problems.name}>
        {(c) => <Input {...c} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} className="h-11" />}
      </Field>
      <Field label="Kod" error={problems.code} hint={editing ? "Kod sonradan değiştirilemez." : CODE_HINT}>
        {(c) => (
          <Input
            {...c}
            value={form.code}
            readOnly={editing}
            autoCapitalize="characters"
            onChange={(e) => onChange({ ...form, code: normalizeCode(e.target.value) })}
            className={editing ? "h-11 bg-muted" : "h-11"}
          />
        )}
      </Field>
    </>
  );
}

// Ekle/duzenle paneli sagdan acilir (UI_GUIDE bolum 5.5, Figma: 06 Admin > /admin/departments - duzenleme paneli)
export function DepartmentSheet({ target, onClose, onDone }: DepartmentSheetProps) {
  const editing = target.mode === "edit";
  const [form, setForm] = useState<DepartmentForm>(() =>
    editing ? { name: target.department.name, code: target.department.code } : EMPTY_DEPARTMENT_FORM,
  );
  const [submitted, setSubmitted] = useState(false);
  const saving = useSaveDepartment(target, onDone);
  const problems = submitted ? departmentFormProblems(form, target.mode) : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(departmentFormProblems(form, target.mode)).length === 0) {
      saving.save(form);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-5 overflow-y-auto p-6 sm:max-w-[440px]">
        <SheetTitle className="text-lg font-semibold">{editing ? "Birimi düzenle" : "Birim ekle"}</SheetTitle>
        <SheetDescription>
          {editing ? target.department.name : "Yeni birim, kullanıcı eklerken ve bildirim atarken seçilebilir."}
        </SheetDescription>
        <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
          <DepartmentFields form={form} problems={problems} editing={editing} onChange={setForm} />
          <FormAlert error={saving.error} />
          {editing ? <StatusSection department={target.department} onDone={onDone} /> : null}
          <div className="mt-auto flex justify-end gap-2 pt-2">
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
