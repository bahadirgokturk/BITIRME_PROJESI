import type { MetadataRoute } from "next";

// Telefona kurulan uygulamanin kimligi (Figma: 01 Foundations > PWA ayarlari). Service worker yok (v1):
// veri anlik olmali, oturum bilgisi onbellege girmemeli (docs/ARCHITECTURE.md ADR-9).
// Beyaz tema rengi, uygulamanin beyaz ust cubuguyla kesintisiz birlesir.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BakırçayFlow",
    short_name: "BakırçayFlow",
    description: "Kampüsteki sorunları bildir, çözülene kadar takip et.",
    start_url: "/",
    display: "standalone",
    lang: "tr",
    theme_color: "#ffffff",
    background_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
