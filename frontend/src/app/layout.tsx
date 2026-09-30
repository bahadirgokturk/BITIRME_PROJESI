import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
  title: "CampusFlow AI",
  description: "Kampüs olay, görev ve karar destek platformu",
  // iPhone'da "Ana Ekrana Ekle" ile tam ekran acilir; saat/pil cubugu beyaz zeminde koyu yazi
  appleWebApp: { capable: true, title: "CampusFlow", statusBarStyle: "default" },
};

// Telefonun durum cubugu uygulamanin beyaz ust cubuguyla ayni renkte (Figma: PWA ayarlari)
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* Tarayici eklentileri body'ye ozellik ekleyebiliyor (orn. inmaintabuse); yalniz body'nin kendi
          ozelliklerindeki farki susturur, sayfa icerigindeki hydration hatalari gorunmeye devam eder */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
