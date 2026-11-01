import { LogoMark, LogoWordmark } from "@/components/brand/Logo";
import { OfflineBanner } from "@/components/states/OfflineBanner";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

import { LoginForm } from "./LoginForm";

// Iki taraftaki blok ayni yukseklikte: sagdaki kutu soldaki logonun ustunden son satirin altina kadar
// uzanir (Figma: 08 Yeni Stil (A) > 01 giris masaustu)
const BLOCK_HEIGHT = "md:min-h-[470px]";

// Masaustunde soldaki turkuaz tanitim paneli; telefonda gizli (Figma: /login - masaustu, BrandPanel)
function BrandPanel() {
  return (
    <section className="hidden flex-1 flex-col justify-center bg-primary px-20 text-primary-foreground md:flex">
      <div className={`flex flex-col justify-between gap-6 ${BLOCK_HEIGHT}`}>
        {/* Zemin de logo da turkuaz: ince beyaz cerceve logonun kenarini belli eder (yalniz bu panelde) */}
        <LogoMark className="size-24 ring-1 ring-white" />
        <div className="space-y-6">
          <p className="max-w-[18ch] text-4xl leading-tight font-semibold">
            Kampüsteki sorunları bildir, çözülene kadar takip et.
          </p>
          <p>İzmir Bakırçay Üniversitesi · BakırçayFlow</p>
        </div>
      </div>
    </section>
  );
}

// Giris kutusu: baslik, form ve parola notu tek kartta
function LoginCard({ next }: { next?: string }) {
  return (
    <div className="flex flex-1 flex-col rounded-xl border bg-card shadow-xs">
      <header className="space-y-1 px-6 pt-6">
        <h1 className="text-2xl font-semibold">Giriş yap</h1>
        <p className="text-sm text-muted-foreground">Kurum e-postan ve parolanla giriş yap.</p>
      </header>
      <div className="flex flex-1 flex-col justify-center px-6 py-5">
        <LoginForm next={next} />
      </div>
      <p className="border-t px-6 py-4 text-[13px] text-muted-foreground">
        Parolanı mı unuttun? Birim yöneticine ya da sistem yöneticisine başvur.
      </p>
    </div>
  );
}

// Giris formu sutunu: telefonda tam ekran, masaustunde sag tarafta ortada; logo kutunun ustunde ortali
function LoginMain({ next }: { next?: string }) {
  return (
    <main className="flex flex-1 flex-col px-6 pt-18 pb-6 md:items-center md:justify-center md:p-8">
      <div className={`flex w-full flex-col gap-10 md:max-w-[400px] md:gap-5 ${BLOCK_HEIGHT}`}>
        <div className="flex justify-center md:hidden">
          <LogoWordmark size="lg" />
        </div>
        <div className="hidden justify-center md:flex">
          <LogoWordmark />
        </div>
        <LoginCard next={next} />
      </div>
      <p className="mt-auto pt-10 text-center text-xs text-muted-foreground md:hidden">
        İzmir Bakırçay Üniversitesi · Kampüs olay ve görev platformu
      </p>
    </main>
  );
}

// Giris ekrani gorunumu; giris mantigi LoginForm'da (Figma: /login - mobil, /login - masaustu).
// Giris de internet ister: baglanti yoksa ekranin en ustunde soylenir (Figma: /login - mobil - baglanti yok)
export function LoginScreen({ next }: { next?: string }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <OfflineBanner />
      <div className="relative flex flex-1">
        {/* Giristen once de tema secilebilir; sag ust kosede (Figma: 07 Koyu Mod > /login) */}
        <ThemeToggle className="absolute top-3 right-3" />
        <BrandPanel />
        <LoginMain next={next} />
      </div>
    </div>
  );
}
