"use client";

import { ImagePlusIcon } from "lucide-react";
import type { ChangeEvent } from "react";

import { FileThumbs } from "@/components/files/FileThumb";
import { REPORT_FILE_ACCEPT, REPORT_MAX_FILES } from "@/lib/report";

interface AttachmentFieldProps {
  files: File[];
  problem: string | null;
  onPick: (picked: File[]) => void;
  onRemove: (index: number) => void;
}

const HINT_ID = "report-files-hint";

export function AttachmentField({ files, problem, onPick, onRemove }: AttachmentFieldProps) {
  function pick(event: ChangeEvent<HTMLInputElement>) {
    onPick(Array.from(event.target.files ?? []));
    // Ayni dosya kaldirilip yeniden secilebilsin
    event.target.value = "";
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Fotoğraf veya video (isteğe bağlı)</p>
      <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-dashed bg-muted px-4 py-5 text-center has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
        <input
          type="file"
          multiple
          accept={REPORT_FILE_ACCEPT}
          aria-label="Fotoğraf ya da video ekle"
          aria-describedby={HINT_ID}
          onChange={pick}
          className="sr-only"
        />
        <ImagePlusIcon aria-hidden className="size-6 text-primary" />
        <span className="text-sm font-medium text-primary">Fotoğraf ya da video ekle</span>
        <span id={HINT_ID} className="text-xs text-muted-foreground">
          JPG, PNG, WEBP en fazla 10 MB · MP4, MOV en fazla 30 sn ve 50 MB · en fazla {REPORT_MAX_FILES} dosya
        </span>
      </label>
      {problem ? (
        <p aria-live="polite" className="text-xs text-destructive">
          {problem}
        </p>
      ) : null}
      <FileThumbs files={files} onRemove={onRemove} />
    </div>
  );
}
