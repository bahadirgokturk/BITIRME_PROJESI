"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAddComment } from "@/hooks/useComments";
import { commentProblem } from "@/lib/comments";

interface InternalToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function InternalToggle({ id, checked, onChange }: InternalToggleProps) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-[18px] shrink-0 accent-primary"
      />
      İç not (bildirim yapan görmez)
    </label>
  );
}

interface CommentFormProps {
  caseId: number;
  // Personel ve mudur ic not da yazabilir (bildirim yapan gormez)
  allowInternal: boolean;
}

// Yorum yazma kutusu (Figma: 05 Manager > Yorumlar). Gonderilince kutu bosalir; hata olursa yazilan durur.
export function CommentForm({ caseId, allowInternal }: CommentFormProps) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const add = useAddComment(caseId, () => {
    setBody("");
    setInternal(false);
  });
  const problem = commentProblem(body);
  const fieldId = `comment-${caseId}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    add.mutate({ body: body.trim(), is_internal: internal });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <FormAlert error={add.error} />
      <Label htmlFor={fieldId}>Yorum yaz</Label>
      <Textarea
        id={fieldId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Yorumunuzu yazın"
        aria-invalid={problem !== null}
        aria-describedby={problem ? `${fieldId}-problem` : undefined}
        className="min-h-20"
      />
      {problem ? (
        <p id={`${fieldId}-problem`} className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {allowInternal ? <InternalToggle id={`comment-internal-${caseId}`} checked={internal} onChange={setInternal} /> : null}
        <Button type="submit" className="ml-auto h-11 px-5" disabled={body.trim() === "" || problem !== null || add.isPending}>
          {add.isPending ? "Gönderiliyor…" : "Gönder"}
        </Button>
      </div>
    </form>
  );
}
