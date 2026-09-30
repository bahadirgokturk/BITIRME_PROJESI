import { LogoMark, LogoWordmark } from "@/components/brand/Logo";

import { LoginForm } from "./LoginForm";

// Masaustunde soldaki turkuaz tanitim paneli; telefonda gizli (Figma: /login - masaustu, BrandPanel)
function BrandPanel() {
  return (
    <section className="hidden flex-1 flex-col justify-center gap-6 bg-primary px-20 text-primary-foreground md:flex">
      <LogoMark className="size-24" />
      <p className="text-4xl leading-tight font-semibold">Kampüsteki sorunları bildir, çözülene kadar takip et.</p>
      <span aria-hidden className="block h-1 w-8 rounded-[2px] bg-brand-accent" />
      <p className="opacity-85">İzmir Bakırçay Üniversitesi · CampusFlow</p>
    </section>
  );
}

// Giris ekrani gorunumu; giris mantigi LoginForm'da (Figma: /login - mobil, /login - masaustu)
export function LoginScreen() {
  return (
    <div className="flex min-h-dvh flex-1">
      <BrandPanel />
      <main className="flex flex-1 flex-col px-6 pt-18 pb-6 md:items-center md:justify-center md:p-8">
        <div className="flex w-full flex-col gap-10 md:max-w-[380px] md:gap-8">
          <div className="md:hidden">
            <LogoWordmark size="lg" />
          </div>
          <div className="hidden md:block">
            <LogoWordmark />
          </div>
          <div className="space-y-4">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold">Giriş yap</h1>
              <p className="text-sm text-muted-foreground">Kurum e-postan ve parolanla giriş yap.</p>
            </header>
            <LoginForm />
            <p className="text-[13px] text-muted-foreground">
              Parolanı mı unuttun? Birim yöneticine ya da sistem yöneticisine başvur.
            </p>
          </div>
        </div>
        <p className="mt-auto pt-10 text-center text-xs text-muted-foreground md:hidden">
          İzmir Bakırçay Üniversitesi · Kampüs olay ve görev platformu
        </p>
      </main>
    </div>
  );
}
