import { CircleAlertIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";

// Backend cevap verdiyse onun Turkce mesaji gosterilir; cevap yoksa ag sorunudur (docs/UI_GUIDE.md bolum 6)
const NETWORK_MESSAGE = "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";

// Form gonderimi basarisiz oldugunda formun icinde gosterilen hata kutusu (Figma: /login - mobil - hata, Alert)
export function FormAlert({ error }: { error: Error | null }) {
  if (!error) {
    return null;
  }
  return (
    <p role="alert" className="flex gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
      <CircleAlertIcon aria-hidden className="mt-px size-[18px] shrink-0" />
      {error instanceof ApiError ? error.message : NETWORK_MESSAGE}
    </p>
  );
}
