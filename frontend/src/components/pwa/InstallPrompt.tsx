"use client";

import { SquarePlusIcon, ShareIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

// Telefonda 44 px dokunma hedefi (UI_GUIDE bolum 8)
const ACTION_CLASS = "h-11 px-4";

function IosStep({ number, icon, children }: { number: string; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 rounded-md bg-muted px-3 py-2.5 text-sm">
      <span className="font-semibold">{number}</span>
      {icon}
      <span>{children}</span>
    </li>
  );
}

function IosSteps({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-2 pr-3">
      <ol className="space-y-2">
        <IosStep number="1." icon={<ShareIcon aria-hidden className="size-5 text-primary" />}>
          Alttaki Paylaş simgesine dokun
        </IosStep>
        <IosStep number="2." icon={<SquarePlusIcon aria-hidden className="size-5 text-primary" />}>
          “Ana Ekrana Ekle”yi seç
        </IosStep>
      </ol>
      <div className="flex justify-end">
        <Button variant="outline" className={ACTION_CLASS} onClick={onDone}>
          Anladım
        </Button>
      </div>
    </div>
  );
}

// PWA yukleme daveti: ilk bildirimden sonra bir kez, yalniz telefonda (Figma: InstallPrompt)
export function InstallPrompt({ hasCases }: { hasCases: boolean }) {
  const { visible, platform, install, dismiss } = useInstallPrompt(hasCases);
  if (!visible) {
    return null;
  }
  const isIos = platform === "ios";
  return (
    <section
      aria-label="Uygulamayı yükle"
      className="space-y-3 rounded-lg border bg-card pt-3 pr-1 pb-4 pl-4 md:hidden"
    >
      <div className="flex items-start gap-3">
        <LogoMark className="mt-1" />
        <div className="flex-1 space-y-0.5 pt-1">
          <p className="font-semibold">BakırçayFlow’u ana ekranına ekle</p>
          <p className="text-sm text-muted-foreground">
            {isIos
              ? "Uygulama gibi tek dokunuşla açmak için iki adım yeterli:"
              : "Uygulama gibi tek dokunuşla aç, bildirimlerini kolayca takip et."}
          </p>
        </div>
        <Button variant="ghost" className="size-11" aria-label="Kapat" onClick={dismiss}>
          <XIcon className="size-5" />
        </Button>
      </div>
      {isIos ? (
        <IosSteps onDone={dismiss} />
      ) : (
        <div className="flex justify-end gap-2 pr-3">
          <Button variant="outline" className={ACTION_CLASS} onClick={dismiss}>
            Şimdi değil
          </Button>
          <Button className={ACTION_CLASS} onClick={() => void install()}>
            Yükle
          </Button>
        </div>
      )}
    </section>
  );
}
