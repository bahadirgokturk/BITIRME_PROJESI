"use client";

import { CameraIcon, XIcon } from "lucide-react";
import { useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addEvidence, EVIDENCE_MAX_COUNT, EVIDENCE_TYPES } from "@/lib/tasks";

const FIELD_ID = "task-evidence-photo";
const BOX_CLASS =
  "flex h-[72px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/50 text-sm font-medium peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50";

interface EvidencePickerProps {
  photos: File[];
  onChange: (photos: File[]) => void;
}

function PickedPhoto({ photo, onRemove }: { photo: File; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border bg-muted/50 pl-3">
      <CameraIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{photo.name}</span>
      <Button
        type="button"
        variant="ghost"
        className="size-11"
        aria-label={`${photo.name} fotoğrafını kaldır`}
        onClick={onRemove}
      >
        <XIcon aria-hidden className="size-4" />
      </Button>
    </li>
  );
}

function PickedPhotos({ photos, onChange }: EvidencePickerProps) {
  if (photos.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-1.5">
      {photos.map((photo, index) => (
        <PickedPhoto
          key={`${photo.name}-${photo.lastModified}-${index}`}
          photo={photo}
          onRemove={() => onChange(photos.filter((item) => item !== photo))}
        />
      ))}
    </ul>
  );
}

// Kanit fotograflari: telefonda dosya secici kamerayi ya da galeriyi sunar (Figma: CompleteSheet > PhotoPicker)
export function EvidencePicker({ photos, onChange }: EvidencePickerProps) {
  const [problem, setProblem] = useState<string | null>(null);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const result = addEvidence(photos, Array.from(event.target.files ?? []));
    setProblem(result.problem);
    onChange(result.photos);
    // Ayni dosya yeniden secilebilsin
    event.target.value = "";
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={FIELD_ID}>Kanıt fotoğrafı (isteğe bağlı)</Label>
      <input
        id={FIELD_ID}
        type="file"
        multiple
        accept={EVIDENCE_TYPES.join(",")}
        onChange={pick}
        className="peer sr-only"
      />
      <PickedPhotos photos={photos} onChange={onChange} />
      {photos.length < EVIDENCE_MAX_COUNT ? (
        <label htmlFor={FIELD_ID} className={BOX_CLASS}>
          <CameraIcon aria-hidden className="size-5 text-muted-foreground" />
          {photos.length > 0 ? "Fotoğraf daha ekle" : "Fotoğraf ekle"}
        </label>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Fotoğraf eklersen iş ek doğrulama beklemeden kapanır.
      </p>
      {problem ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
