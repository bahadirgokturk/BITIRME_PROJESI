import { ImageIcon, VideoIcon, XIcon } from "lucide-react";

import { isVideo } from "@/lib/report";

interface FileThumbsProps {
  files: File[];
  onRemove: (index: number) => void;
}

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

// Secilen dosyalarin listesi; bildirim formu ve personelin kanit fotograflari ayni gorunumu kullanir
export function FileThumbs({ files, onRemove }: FileThumbsProps) {
  if (files.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Eklenen dosyalar" className="flex flex-wrap gap-3 pt-2">
      {files.map((file, index) => (
        <FileThumb key={`${index}-${file.name}`} file={file} onRemove={() => onRemove(index)} />
      ))}
    </ul>
  );
}
