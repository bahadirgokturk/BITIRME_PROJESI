"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCreateUser, useUpdateUser, type AdminUser } from "@/hooks/useAdminUsers";
import { EMPTY_USER_FORM, formFromUser, toUserBody, userFormProblems, type UserForm } from "@/lib/admin";

import { ActiveToggle } from "./AdminParts";
import { UserFormFields } from "./UserFormFields";

const ACTIVE_NOTE =
  "Pasifleştirilen kullanıcının tüm oturumları hemen kapanır. Kayıt silinmez; istediğiniz zaman yeniden aktifleştirebilirsiniz.";
const INACTIVE_NOTE = "Kullanıcı yeniden giriş yapabilir; eski oturumları geri gelmez.";

export type SheetTarget = { mode: "create" } | { mode: "edit"; user: AdminUser };

interface UserSheetProps {
  target: SheetTarget;
  departments: readonly { id: number; name: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}

// Pasiflestirme silme degildir: kayit kalir, oturumlar backend'de hemen kapanir (docs/API.md)
function StatusSection({ user, onDone }: { user: AdminUser; onDone: (message: string) => void }) {
  const update = useUpdateUser(user.id);
  const next = !user.is_active;
  return (
    <ActiveToggle
      active={user.is_active}
      subject="Kullanıcıyı"
      note={user.is_active ? ACTIVE_NOTE : INACTIVE_NOTE}
      error={update.error}
      pending={update.isPending}
      onToggle={() =>
        update.mutate(
          { is_active: next },
          { onSuccess: () => onDone(`${user.full_name} ${next ? "aktifleştirildi" : "pasifleştirildi"}.`) },
        )
      }
    />
  );
}

// Ekle (POST) ya da duzenle (PATCH); ikisi de basarida ayni mesaj kalibini kullanir
function useSaveUser(target: SheetTarget, onDone: (message: string) => void) {
  const create = useCreateUser();
  const update = useUpdateUser(target.mode === "edit" ? target.user.id : 0);
  const active = target.mode === "create" ? create : update;
  function save(form: UserForm) {
    const done = (verb: string) => () => onDone(`${form.full_name.trim()} ${verb}.`);
    if (target.mode === "create") {
      create.mutate({ ...toUserBody(form), password: form.password }, { onSuccess: done("eklendi") });
      return;
    }
    update.mutate(toUserBody(form), { onSuccess: done("güncellendi") });
  }
  return { save, error: active.error, isPending: active.isPending };
}

// Ekle/duzenle paneli sagdan acilir (UI_GUIDE bolum 5.5, Figma: 06 Admin > UserSheet)
export function UserSheet({ target, departments, onClose, onDone }: UserSheetProps) {
  const [form, setForm] = useState<UserForm>(() => (target.mode === "edit" ? formFromUser(target.user) : EMPTY_USER_FORM));
  const [submitted, setSubmitted] = useState(false);
  const saving = useSaveUser(target, onDone);
  const problems = submitted ? userFormProblems(form, target.mode) : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(userFormProblems(form, target.mode)).length === 0) {
      saving.save(form);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-5 overflow-y-auto p-6 sm:max-w-[440px]">
        <SheetTitle className="text-lg font-semibold">{target.mode === "create" ? "Kullanıcı ekle" : "Kullanıcıyı düzenle"}</SheetTitle>
        <SheetDescription>
          {target.mode === "edit" ? `${target.user.full_name} · ${target.user.email}` : "Yeni kullanıcı kampüs hesabıyla giriş yapar."}
        </SheetDescription>
        <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
          <UserFormFields form={form} problems={problems} mode={target.mode} departments={departments} onChange={setForm} />
          <FormAlert error={saving.error} />
          {target.mode === "edit" ? <StatusSection user={target.user} onDone={onDone} /> : null}
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
