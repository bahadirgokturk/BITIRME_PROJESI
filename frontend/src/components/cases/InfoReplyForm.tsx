"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CaseRead } from "@/hooks/useCases";
import { useReplyInfo } from "@/hooks/useCaseActions";
import { reporterView } from "@/lib/status";

import { CaseStatusView } from "./CaseStatusView";

// Ek bilgi bekleyen bildirim: sorulan soru + yanit kutusu (Figma: InfoReply). Yanit gonderilince
// bildirim yeniden "Alindi" olur ve bu kutu kaybolur.
export function InfoReplyForm({ item }: { item: CaseRead }) {
  const [body, setBody] = useState("");
  const reply = useReplyInfo(item.id);
  const fieldId = `info-reply-${item.id}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reply.mutate({ body: body.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
      <CaseStatusView view={reporterView(item.status, item.info_request)} />
      <FormAlert error={reply.error} />
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>Yanıtın</Label>
        <Textarea
          id={fieldId}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Sorulan soruyu kısaca yanıtla"
          className="min-h-24"
        />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={body.trim() === "" || reply.isPending}>
        {reply.isPending ? "Gönderiliyor…" : "Yanıtı gönder"}
      </Button>
    </form>
  );
}
