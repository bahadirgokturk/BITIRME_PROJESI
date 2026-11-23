"use client";

import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePhotoSuggest } from "@/hooks/usePhotoSuggest";

const PERCENT = 100;

interface PhotoSuggestionProps {
  // Eklenen ilk fotograf; video ve fotograf yoksa oneri sorulmaz
  photo: File | undefined;
  onPick: (name: string) => void;
}

// Fotografa gore tur onerisi: dokununca aciklamaya yazilir, kisi duzeltebilir. Turu yine agent'lar belirler
export function PhotoSuggestion({ photo, onPick }: PhotoSuggestionProps) {
  const suggestions = usePhotoSuggest(photo).data ?? [];
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <div role="group" aria-label="Fotoğrafa göre öneri" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <SparklesIcon aria-hidden className="size-4" />
        Fotoğrafta görünen:
      </span>
      {suggestions.map((item) => (
        <Button
          key={item.case_type_code}
          type="button"
          variant="outline"
          className="h-9 px-3"
          onClick={() => onPick(item.name)}
        >
          {item.name} (%{Math.round(item.confidence * PERCENT)})
        </Button>
      ))}
    </div>
  );
}
