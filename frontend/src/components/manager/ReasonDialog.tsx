"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReasonDialogProps<Body> {
  trigger: string;
  title: string;
  description: ReactNode;
  confirm: string;
  mutation: UseMutationResult<unknown, Error, Body>;
  toBody: (reason: string) => Body;
  onDone: () => void;
  // Gerekcenin ustunde ek alan (ornek: yeni oncelik secimi)
  extra?: ReactNode;
}

// Gerekce isteyen manager islemleri (reddet, birlestir, kapat, duzelt): gerekce zorunlu ve
// decision_feedback'e yazilir; backend hatasi pencerede gosterilir, pencere acik kalir
export function ReasonDialog<Body>(props: ReasonDialogProps<Body>) {
  const { trigger, title, description, confirm, mutation, toBody, onDone, extra } = props;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const fieldId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(toBody(reason.trim()), {
      onSuccess: () => {
        setOpen(false);
        onDone();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-11 px-4" />}>{trigger}</DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-4 p-6 md:max-w-[480px]">
        <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          {extra}
          <div className="space-y-1.5">
            <Label htmlFor={fieldId}>Gerekçe (zorunlu)</Label>
            <Textarea id={fieldId} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24" />
          </div>
          <FormAlert error={mutation.error} />
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline" className="h-11 px-4" />}>Vazgeç</DialogClose>
            <Button type="submit" className="h-11 px-4" disabled={reason.trim() === "" || mutation.isPending}>
              {mutation.isPending ? "Kaydediliyor…" : confirm}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
