import { LogoWordmark } from "@/components/brand/Logo";

import { LogoutButton } from "./LogoutButton";
import { PasswordForm } from "./PasswordForm";

// Hesap yeni acildiysa ya da yonetici parolayi sifirladiysa (me.must_change_password) once kendi parolasi
// belirlenir; menu ve sayfalar gosterilmez. Basarida kullanici bilgisi yenilenir ve kabuk acilir.
export function FirstPasswordScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-6 pt-18 pb-6 md:justify-center md:p-8">
      <div className="flex w-full max-w-[460px] flex-col gap-8">
        <LogoWordmark size="lg" />
        <section className="space-y-5 surface p-6 md:p-8">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold">Yeni parolanızı belirleyin</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Hesabın geçici bir parolayla açıldı. Devam etmek için kendi parolanı belirle.
            </p>
          </header>
          <PasswordForm currentLabel="Geçici parola" onDone={() => undefined} />
        </section>
        <div className="max-w-40">
          <LogoutButton size="desktop" />
        </div>
      </div>
    </main>
  );
}
