import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";

import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BakırçayFlow",
  description: "Kampüs olay, görev ve karar destek platformu",
  // iPhone'da "Ana Ekrana Ekle" ile tam ekran acilir; saat/pil cubugu beyaz zeminde koyu yazi
  appleWebApp: { capable: true, title: "BakırçayFlow", statusBarStyle: "default" },
};

// Telefonun durum cubugu uygulamanin ust cubuguyla ayni renkte (Figma: PWA ayarlari). Ilk deger cihaz
// ayarina gore; kullanici temayi degistirince useTheme meta etiketini gunceller.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Tema betigi html'e "dark" sinifi ekleyebilir; yalniz html'in kendi ozelliklerindeki fark susturulur
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Sayfa cizilmeden tema uygulanir (koyu temada acilista beyaz parlama olmaz) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Tarayici eklentileri body'ye ozellik ekleyebiliyor (orn. inmaintabuse); yalniz body'nin kendi
          ozelliklerindeki farki susturur, sayfa icerigindeki hydration hatalari gorunmeye devam eder */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
