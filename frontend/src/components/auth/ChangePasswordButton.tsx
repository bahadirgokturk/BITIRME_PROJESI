"use client";

import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { PasswordForm } from "./PasswordForm";

// Cikis dugmesiyle ayni boy: masaustu 40 px, telefon menusu 44 px
const SIZE_CLASS = {
  desktop: "h-10 text-sm",
  mobile: "h-11 text-[15px]",
} as const;

const TRIGGER_CLASS = "w-full justify-start gap-2.5 px-3 font-normal";

// Hesap kutusunda "Parolayi degistir": pencerede mevcut + yeni parola; basarida bu cihazda oturum surer
export function ChangePasswordButton({ size }: { size: keyof typeof SIZE_CLASS }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  function toggle(next: boolean) {
    setOpen(next);
    setDone(false);
  }

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogTrigger render={<Button variant="ghost" className={`${TRIGGER_CLASS} ${SIZE_CLASS[size]}`} />}>
        <KeyRoundIcon aria-hidden className="size-5" />
        Parolayı değiştir
      </DialogTrigger>
      <DialogContent className="gap-4 sm:max-w-[420px]">
        <DialogTitle className="text-lg font-semibold">Parolayı değiştir</DialogTitle>
        <DialogDescription>
          Değiştirince diğer cihazlardaki oturumların kapanır; bu cihazda devam edersin.
        </DialogDescription>
        {done ? (
          <div className="space-y-4">
            <p role="status" className="rounded-md bg-muted px-3 py-2.5 text-sm">
              Parolan değiştirildi. Diğer cihazlardaki oturumların kapatıldı.
            </p>
            <Button className="h-11 w-full" onClick={() => toggle(false)}>
              Kapat
            </Button>
          </div>
        ) : (
          <PasswordForm currentLabel="Mevcut parola" onDone={() => setDone(true)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
