"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { INSTALL_PROMPT_DISMISSED_KEY, installPlatform, shouldShowInstallPrompt } from "@/lib/pwa";

// Chrome'a ozel olay; TypeScript'in DOM tiplerinde yok
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Gizli sekme ya da engellenmis site verisinde localStorage hata atar: davet o zaman kapali sayilmaz
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "1";
  } catch (error: unknown) {
    if (error instanceof DOMException) {
      return false;
    }
    throw error;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
  } catch (error: unknown) {
    // Yazilamazsa davet yalniz bu oturumda kapanir
    if (!(error instanceof DOMException)) {
      throw error;
    }
  }
}

function isStandalone(): boolean {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

// Bu degerler sayfa acikken degismez; abonelik gerekmez
const noSubscription = () => () => undefined;
const readUserAgent = () => window.navigator.userAgent;

// Sunucuda tarayici bilgisi yok: ilk cizimde davet kapali sayilir (hydration uyumsuzlugu olmaz)
function useBrowserValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscription, read, () => serverValue);
}

export function useInstallPrompt(hasCases: boolean) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedNow, setDismissedNow] = useState(false);
  const userAgent = useBrowserValue(readUserAgent, "");
  const standalone = useBrowserValue(isStandalone, false);
  const dismissedBefore = useBrowserValue(readDismissed, true);

  useEffect(() => {
    function onInstallable(event: Event) {
      // Tarayicinin kendi cubugu yerine bizim davetimiz gosterilir
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onInstallable);
    return () => window.removeEventListener("beforeinstallprompt", onInstallable);
  }, []);

  function dismiss() {
    writeDismissed();
    setDismissedNow(true);
  }

  // Tarayicinin kendi yukleme penceresi acilir; sonuc ne olursa olsun davet bir daha sorulmaz
  async function install() {
    dismiss();
    await deferred?.prompt();
  }

  const platform = installPlatform(userAgent, deferred !== null);
  const dismissed = dismissedBefore || dismissedNow;
  const visible = shouldShowInstallPrompt({ platform, standalone, dismissed, hasCases });
  return { visible, platform, install, dismiss };
}
