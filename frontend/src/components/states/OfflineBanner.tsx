"use client";

import { WifiOffIcon } from "lucide-react";

import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

// Baglanti kopunca icerigin ustunde serit (Figma: OfflineBanner). Baglanti gelince sorgular kendiliginden
// yeniden okunur (TanStack Query refetchOnReconnect), bu yuzden metin "yenilenir" der.
// role="status" kutusu hep yerinde durur: ekran okuyucu sonradan gelen metni duyurur.
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnline();
  return (
    <div role="status" className={cn("z-30 bg-background print:hidden", className)}>
      {online ? null : (
        <p className="flex items-center gap-2 border-b bg-warning/10 px-4 py-2.5 text-[13px] font-medium">
          <WifiOffIcon aria-hidden className="size-[18px] shrink-0 text-warning" />
          İnternet bağlantınız yok. Bağlanınca sayfa yenilenir.
        </p>
      )}
    </div>
  );
}
