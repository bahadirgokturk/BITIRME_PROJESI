"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TaskNoteInput } from "@/hooks/useTasks";
import { isValidTaskNote, TASK_NOTE_MAX_LENGTH } from "@/lib/tasks";

import { EvidencePicker } from "./EvidencePicker";

const ACTION_CLASS = "h-11 flex-1";
// Telefonda alttan acilan panel, masaustunde ortada pencere (Figma: CompleteSheet, DeclineSheet)
const PANEL_CLASS =
  "max-h-dvh gap-3 overflow-y-auto p-6 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:px-4 md:max-w-[480px]";

export interface TaskNoteCopy {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  submit: string;
  submitting: string;
}

interface TaskNoteDialogProps {
  copy: TaskNoteCopy;
  trigger: ReactElement;
  required: boolean;
  // Tamamlama panelinde kanit fotografi alani da gosterilir
  withPhoto?: boolean;
  error: Error | null;
  isPending: boolean;
  onSubmit: (input: TaskNoteInput, done: () => void) => void;
}

type FormProps = Omit<TaskNoteDialogProps, "trigger"> & { done: () => void };

function NoteForm({ copy, required, withPhoto, error, isPending, onSubmit, done }: FormProps) {
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const fieldId = `task-note-${copy.submit}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ note: note.trim(), photos }, done);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FormAlert error={error} />
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{copy.label}</Label>
        <Textarea
          id={fieldId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={TASK_NOTE_MAX_LENGTH}
          placeholder={copy.placeholder}
          className="min-h-24"
        />
      </div>
      {withPhoto ? <EvidencePicker photos={photos} onChange={setPhotos} /> : null}
      <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" className={ACTION_CLASS} />}>Vazgeç</DialogClose>
        <Button type="submit" className={ACTION_CLASS} disabled={isPending || (required && !isValidTaskNote(note))}>
          {isPending ? copy.submitting : copy.submit}
        </Button>
      </div>
    </form>
  );
}

// Not isteyen gorev islemleri (tamamla, reddet) ayni paneli kullanir; metinler copy ile gelir
export function TaskNoteDialog({ trigger, ...form }: TaskNoteDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{form.copy.submit}</DialogTrigger>
      <DialogContent showCloseButton={false} className={PANEL_CLASS}>
        <DialogTitle className="text-lg font-semibold">{form.copy.title}</DialogTitle>
        <DialogDescription>{form.copy.description}</DialogDescription>
        <NoteForm {...form} done={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
