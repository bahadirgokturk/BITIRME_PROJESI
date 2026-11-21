"use client";

import { useState, type KeyboardEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminUser } from "@/hooks/useAdminUsers";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useResetUserPassword } from "@/hooks/usePassword";
import { resetPasswordProblem } from "@/lib/password";

import { Field } from "./Field";

const BOX_CLASS = "space-y-2 rounded-lg border p-4";
const NOTE =
  "Unutulan parola için geçici parola verin ve kullanıcıya iletin. Açık oturumları kapanır; " +
  "ilk girişte kendi parolasını belirler.";

// Yoneticinin kendi parolasi buradan sifirlanamaz (backend 409 SELF_LOCKOUT): form yerine yol gosterilir
function OwnAccountNote() {
  return (
    <div className={BOX_CLASS}>
      <p className="text-sm font-medium">Parola</p>
      <p className="text-[13px] text-muted-foreground">
        Kendi parolanı buradan sıfırlayamazsın; sol alttaki hesap kutusunda &quot;Parolayı değiştir&quot;i kullan.
      </p>
    </div>
  );
}

function BoxHeading({ title, note }: { title: string; note: string }) {
  return (
    <>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-[13px] text-muted-foreground">{note}</p>
    </>
  );
}

function ResetDone({ name }: { name: string }) {
  return (
    <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
      {name} için geçici parola verildi. İlk girişte kendi parolasını belirleyecek.
    </p>
  );
}

function ResetForm({ user }: { user: AdminUser }) {
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const reset = useResetUserPassword(user.id);

  function send() {
    const found = resetPasswordProblem(password);
    setProblem(found);
    if (found === null) {
      reset.mutate(password, { onSuccess: () => setPassword("") });
    }
  }

  // Panelin kendi formu (Kaydet) Enter ile gonderilmesin: Enter burada yalniz sifirlar
  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className={BOX_CLASS}>
      <BoxHeading title="Parolayı sıfırla" note={NOTE} />
      <Field label="Geçici parola" error={problem ?? undefined}>
        {(control) => (
          <Input
            {...control}
            autoComplete="off"
            value={password}
            onKeyDown={onKey}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 text-base"
          />
        )}
      </Field>
      <FormAlert error={reset.error} />
      {reset.isSuccess ? <ResetDone name={user.full_name} /> : null}
      <Button type="button" variant="outline" className="h-11 px-4" disabled={reset.isPending} onClick={send}>
        {reset.isPending ? "Sıfırlanıyor…" : "Parolayı sıfırla"}
      </Button>
    </div>
  );
}

// Kullanici duzenleme panelinde: gecici parola ver (POST /admin/users/{id}/password)
export function PasswordResetSection({ user }: { user: AdminUser }) {
  const me = useCurrentUser().data;
  return me?.id === user.id ? <OwnAccountNote /> : <ResetForm user={user} />;
}
