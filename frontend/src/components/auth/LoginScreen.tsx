import { LogoMark, LogoWordmark } from "@/components/brand/Logo";
import { OfflineBanner } from "@/components/states/OfflineBanner";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

import { LoginForm } from "./LoginForm";

// Masaustunde soldaki turkuaz tanitim paneli; telefonda gizli. Genis ekranda altin oran: panel %38,2,
// giris alani %61,8 (Figma: 08 Yeni Stil (A) > giris E). Tablette %38 yaziya dar kalir: orada %45.
function BrandPanel() {
  return (
    <section
      className={
        "hidden flex-col justify-center gap-6 bg-primary px-12 text-primary-foreground " +
        "md:flex md:w-[45vw] md:shrink-0 lg:w-[38.2vw] lg:px-[72px]"
      }
    >
      {/* Zemin de logo da turkuaz: ince beyaz cerceve logonun kenarini belli eder (yalniz bu panelde) */}
      <LogoMark className="size-24 ring-1 ring-white" />
      <p className="text-4xl leading-tight font-semibold lg:text-[40px] lg:leading-[1.2]">
        Kampüsteki sorunları bildir, çözülene kadar takip et.
      </p>
      <p>İzmir Bakırçay Üniversitesi · BakırçayFlow</p>
    </section>
  );
}

// Giris kutusu: baslik, form ve parola notu tek kartta
function LoginCard({ next }: { next?: string }) {
  return (
    <div className="flex flex-1 flex-col surface">
      <header className="space-y-1 px-6 pt-6 md:px-8 md:pt-8">
        <h1 className="text-2xl font-semibold md:text-[26px]">Giriş yap</h1>
        <p className="text-sm text-muted-foreground md:text-base">Kurum e-postan ve parolanla giriş yap.</p>
      </header>
      <div className="flex flex-1 flex-col justify-center px-6 py-5 md:px-8 md:py-6">
        <LoginForm next={next} />
      </div>
      <p className="border-t px-6 py-4 text-[13px] text-muted-foreground md:px-8 md:py-5 md:text-sm">
        Parolanı mı unuttun? Birim yöneticine ya da sistem yöneticisine başvur.
      </p>
    </div>
  );
}

// Giris formu sutunu: telefonda tam ekran, masaustunde sag tarafta ortada;
// logo kutunun ustunde (telefonda ortali, masaustunde solda)
function LoginMain({ next }: { next?: string }) {
  return (
    <main className="flex flex-1 flex-col px-6 pt-18 pb-6 md:items-center md:justify-center md:p-8">
      <div className="flex w-full flex-col gap-10 md:max-w-[520px] md:gap-6">
        {/* Telefonda simge solda agirlik yaptigi icin tam ortada saga kaymis gorunur, logo biraz sola alinir;
            masaustunde logo kutunun sol kenarina hizali */}
        <div className="flex justify-center pr-6 md:justify-start md:pr-0">
          <LogoWordmark size="lg" />
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
