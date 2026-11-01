"use client";

import { CameraIcon } from "lucide-react";
import { useState, type ChangeEvent } from "react";

import { FormAlert } from "@/components/states/FormAlert";
import { useAddWorkPhotos } from "@/hooks/useTasks";
import { addEvidence, EVIDENCE_TYPES } from "@/lib/tasks";

const FIELD_ID = "task-work-photo";
const BOX_CLASS =
  "flex h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/50 " +
  "text-sm font-medium text-primary-text peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50";

// Is surerken cekilen fotograf hemen bildirime kanit olarak eklenir (Figma: 08 Yeni Stil (A) > gorev detayi).
// Telefonda dosya secici kamerayi ya da galeriyi sunar; kurallar tamamlama panelindekiyle ayni (lib/tasks.ts)
export function WorkPhotoButton({ caseId }: { caseId: number }) {
  const add = useAddWorkPhotos(caseId);
  const [problem, setProblem] = useState<string | null>(null);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const result = addEvidence([], Array.from(event.target.files ?? []));
    setProblem(result.problem);
    if (result.photos.length > 0) {
      add.mutate(result.photos);
    }
    // Ayni dosya yeniden secilebilsin
    event.target.value = "";
  }

  return (
    <div className="space-y-2">
      <input
        id={FIELD_ID}
        type="file"
        multiple
        accept={EVIDENCE_TYPES.join(",")}
        onChange={pick}
        disabled={add.isPending}
        className="peer sr-only"
      />
      <label htmlFor={FIELD_ID} className={BOX_CLASS}>
        <CameraIcon aria-hidden className="size-5" />
        {add.isPending ? "Fotoğraf yükleniyor…" : "İş sonrası fotoğraf ekle"}
      </label>
      {problem ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {problem}
        </p>
      ) : null}
      <FormAlert error={add.error} />
      {add.isSuccess ? (
        <p role="status" className="text-sm text-muted-foreground">
          {add.data} fotoğraf eklendi.
        </p>
      ) : null}
    </div>
  );
}
