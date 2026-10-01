"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReopenCase } from "@/hooks/useCaseActions";
import { isValidReopenReason, REOPEN_REASON_MAX_LENGTH } from "@/lib/caseActions";

const ACTION_CLASS = "h-11 flex-1";
// Telefonda alttan acilan panel, masaustunde ortada pencere (Figma: ReopenSheet / ReopenDialog)
const PANEL_CLASS =
  "gap-3 p-6 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:px-4 md:max-w-[480px]";

function ReopenForm({ caseId, onDone }: { caseId: number; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const reopen = useReopenCase(caseId);
  const fieldId = `reopen-reason-${caseId}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reopen.mutate({ reason: reason.trim() }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FormAlert error={reopen.error} />
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>Neden yeniden açıyorsun?</Label>
        <Textarea
          id={fieldId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REOPEN_REASON_MAX_LENGTH}
          placeholder="Örn. Çöp kutusu boşaltıldı ama ertesi gün yine taşmıştı."
          className="min-h-24"
        />
        <p className="text-right text-xs text-muted-foreground">
          {reason.length} / {REOPEN_REASON_MAX_LENGTH}
        </p>
      </div>
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className={ACTION_CLASS} />}>Vazgeç</DialogClose>
        <Button type="submit" className={ACTION_CLASS} disabled={!isValidReopenReason(reason) || reopen.isPending}>
          {reopen.isPending ? "Açılıyor…" : "Yeniden aç"}
        </Button>
      </div>
    </form>
  );
}

// "Sorun devam ediyor": gerekce zorunlu; bildirim REOPENED (Alindi) olur
export function ReopenDialog({ caseId }: { caseId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-11 w-full" />}>Sorun devam ediyor</DialogTrigger>
      <DialogContent showCloseButton={false} className={PANEL_CLASS}>
        <DialogTitle className="text-lg font-semibold">Sorun devam ediyor</DialogTitle>
        <DialogDescription>
          Bildirimin yeniden açılır ve ilgili birime tekrar iletilir. Neyin eksik kaldığını kısaca yaz.
        </DialogDescription>
        <ReopenForm caseId={caseId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
