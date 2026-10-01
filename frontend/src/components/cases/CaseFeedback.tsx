"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CaseRead } from "@/hooks/useCases";
import { useSubmitFeedback } from "@/hooks/useCaseActions";
import { ACTION_WINDOW_HOURS, closedCaseActions, ratingLabel, type Rating } from "@/lib/caseActions";

import { RatingDisplay, RatingInput } from "./RatingStars";
import { ReopenDialog } from "./ReopenDialog";

function RatingForm({ caseId }: { caseId: number }) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const feedback = useSubmitFeedback(caseId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) {
      return;
    }
    feedback.mutate({ rating, comment: comment.trim() || null });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-semibold">Sorun çözüldü mü?</h2>
      <p className="text-sm text-muted-foreground">Çözümü puanla, hizmeti iyileştirmemize yardımcı ol.</p>
      <RatingInput value={rating} onChange={setRating} />
      {rating === null ? null : <p className="text-sm font-medium">{ratingLabel(rating)}</p>}
      <FormAlert error={feedback.error} />
      <Textarea
        aria-label="Yorum (isteğe bağlı)"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Eklemek istediğin bir şey var mı? (isteğe bağlı)"
        className="min-h-18"
      />
      <Button type="submit" className="h-11 w-full" disabled={rating === null || feedback.isPending}>
        {feedback.isPending ? "Gönderiliyor…" : "Değerlendirmeyi gönder"}
      </Button>
    </form>
  );
}

function RatingThanks({ rating }: { rating: number }) {
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Değerlendirmen alındı</h2>
      <RatingDisplay value={rating} />
      <p className="text-sm text-muted-foreground">Teşekkürler, puanın hizmeti iyileştirmemize yardımcı olur.</p>
    </div>
  );
}

function ReopenSection({ caseId }: { caseId: number }) {
  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-sm font-medium">Sorun hâlâ sürüyor mu?</p>
      <ReopenDialog caseId={caseId} />
      <p className="text-xs text-muted-foreground">
        Kapanıştan sonraki {ACTION_WINDOW_HOURS} saat içinde yeniden açabilirsin.
      </p>
    </div>
  );
}

// Kapanmis bildirimde puan ve yeniden acma (Figma: CaseFeedback). Gosterilecek bir sey yoksa hic cizilmez.
export function CaseFeedback({ item }: { item: CaseRead }) {
  const actions = closedCaseActions(item);
  const rated = actions.rating !== null;
  if (!actions.canRate && !actions.canReopen && !rated) {
    return null;
  }
  return (
    <section aria-label="Değerlendirme" className="space-y-3 rounded-lg border bg-card p-4">
      {actions.canRate ? <RatingForm caseId={item.id} /> : null}
      {actions.rating === null ? null : <RatingThanks rating={actions.rating} />}
      {actions.canReopen ? <ReopenSection caseId={item.id} /> : null}
    </section>
  );
}
