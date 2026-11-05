import { RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DraftNoticeProps {
  hadFiles: boolean;
  onDiscard: () => void;
}

// Yarim kalan bildirim geri yuklendiginde baslik ile form arasinda (Figma: DraftNotice)
export function DraftNotice({ hadFiles, onDiscard }: DraftNoticeProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted py-2 pr-1 pl-3">
      <RotateCcwIcon aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">Taslağınız geri yüklendi.</p>
        {hadFiles ? <p className="text-xs text-muted-foreground">Fotoğrafları yeniden eklemelisiniz.</p> : null}
      </div>
      <Button type="button" variant="ghost" className="h-11 shrink-0 px-3 md:h-10" onClick={onDiscard}>
        Taslağı sil
      </Button>
    </div>
  );
}
