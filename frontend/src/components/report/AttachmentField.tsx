"use client";

import { ImageIcon, ImagePlusIcon, VideoIcon, XIcon } from "lucide-react";
import type { ChangeEvent } from "react";

import { isVideo, REPORT_FILE_ACCEPT, REPORT_MAX_FILES } from "@/lib/report";

interface AttachmentFieldProps {
  files: File[];
  problem: string | null;
  onPick: (picked: File[]) => void;
  onRemove: (index: number) => void;
}

const HINT_ID = "report-files-hint";

// Eklenen dosya: kucuk kare + kaldir butonu. Gorunen daire 20 px, dokunma alani 44 px (UI_GUIDE bolum 8)
function FileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const Icon = isVideo(file) ? VideoIcon : ImageIcon;
  return (
    <li aria-label={file.name} className="relative grid size-18 place-items-center rounded-lg border bg-muted">
      <Icon aria-hidden className="size-6 text-muted-foreground" />
      <button
        type="button"
        aria-label={`${file.name} dosyasını kaldır`}
        onClick={onRemove}
        className="absolute -top-3 -right-3 grid size-11 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="grid size-5 place-items-center rounded-full bg-foreground text-background">
          <XIcon aria-hidden className="size-3" />
        </span>
      </button>
    </li>
  );
}

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
          JPG, PNG, WEBP en fazla 5 MB · MP4, MOV en fazla 30 sn ve 50 MB · en fazla {REPORT_MAX_FILES} dosya
        </span>
      </label>
      {problem ? (
        <p aria-live="polite" className="text-xs text-destructive">
          {problem}
        </p>
      ) : null}
      {files.length > 0 ? (
        <ul aria-label="Eklenen dosyalar" className="flex flex-wrap gap-3 pt-2">
          {files.map((file, index) => (
            <FileThumb key={`${index}-${file.name}`} file={file} onRemove={() => onRemove(index)} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
