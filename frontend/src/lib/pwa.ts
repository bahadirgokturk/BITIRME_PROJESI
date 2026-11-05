// PWA yukleme daveti kurallari (Figma: 02 Components > InstallPrompt, 01 Foundations > PWA ayarlari)

export type InstallPlatform = "android" | "ios";

// Kapatilan davet bu cihazda bir daha gosterilmez
export const INSTALL_PROMPT_DISMISSED_KEY = "campusflow.installPromptDismissed";

const IOS_DEVICE = /iPhone|iPad|iPod/;

// Android Chrome "beforeinstallprompt" ile tek dokunusla yukler; iPhone Safari bunu desteklemez,
// kullaniciya Paylas > Ana Ekrana Ekle adimlari gosterilir
export function installPlatform(userAgent: string, browserOffersInstall: boolean): InstallPlatform | null {
  if (browserOffersInstall) {
    return "android";
  }
  return IOS_DEVICE.test(userAgent) ? "ios" : null;
}

export interface InstallPromptState {
  platform: InstallPlatform | null;
  standalone: boolean;
  dismissed: boolean;
  hasCases: boolean;
}

// Ilk bildirimden sonra, yuklenebilir cihazda, uygulama zaten kurulu degilse ve daha once kapatilmadiysa
export function shouldShowInstallPrompt(state: InstallPromptState): boolean {
  return state.platform !== null && state.hasCases && !state.standalone && !state.dismissed;
}
