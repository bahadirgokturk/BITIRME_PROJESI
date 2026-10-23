"use client";

import { useQueryClient } from "@tanstack/react-query";
import { WifiOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { useOnline, useServerUnreachable } from "@/hooks/useOnline";
import { ApiError, apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// Istekler ag hatasiyla dustuyse sunucu bu aralikla yoklanir; 10 sn hem hizli fark eder hem yuk getirmez
export const RECONNECT_CHECK_MS = 10_000;

// Yoklamanin cevabi onemli degil: her cevap (503 da) client.ts'te "ulasildi" diye isaretlenir.
// Ag hatasi beklenen durumdur, baska bir hata yutulmaz.
function ignoreExpected(error: unknown) {
  if (!(error instanceof TypeError) && !(error instanceof ApiError)) {
    throw error;
  }
}

// Tarayici "bagliyim" dedigi halde istekler dusuyorsa (Windows'ta sanal ag kartlari) sunucu yoklanir;
// sunucu yeniden cevap verince ekrandaki sorgular tazelenir. Tarayicinin kendi baglanti olayinda bunu
// TanStack Query zaten yapar (refetchOnReconnect).
function useReconnectCheck() {
  const unreachable = useServerUnreachable();
  const queryClient = useQueryClient();
  const wasUnreachable = useRef(false);
  useEffect(() => {
    if (wasUnreachable.current && !unreachable) {
      void queryClient.invalidateQueries();
    }
    wasUnreachable.current = unreachable;
    if (!unreachable) {
      return;
    }
    const timer = setInterval(() => apiGet("/health").catch(ignoreExpected), RECONNECT_CHECK_MS);
    return () => clearInterval(timer);
  }, [unreachable, queryClient]);
}

// Baglanti kopunca icerigin ustunde serit (Figma: OfflineBanner). Baglanti gelince sorgular yeniden
// okunur, bu yuzden metin "yenilenir" der.
// role="status" kutusu hep yerinde durur: ekran okuyucu sonradan gelen metni duyurur.
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnline();
  useReconnectCheck();
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
