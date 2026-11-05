"use client";

import { useEffect, useState, type ReactNode } from "react";

import { setTransport } from "@/lib/api/client";

// .env.development: NEXT_PUBLIC_API_MOCKING=enabled iken uygulanmamis endpoint'ler sahte cevap alir.
// Kapaliyken sahte API kodu hic yuklenmez (production paketine girmez).
const MOCKING_ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

async function enableMocking(): Promise<void> {
  const [{ handlers }, { mockTransport }] = await Promise.all([
    import("./handlers"),
    import("./transport"),
  ]);
  setTransport(mockTransport(handlers));
}

type MockState = { status: "starting" } | { status: "ready" } | { status: "failed"; reason: string };

export function MockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockState>({
    status: MOCKING_ENABLED ? "starting" : "ready",
  });

  useEffect(() => {
    if (!MOCKING_ENABLED) {
      return;
    }
    // Transport ayarlanmadan cocuklar render edilmez; hicbir istek sahte API'yi atlayamaz.
    // Yuklenemezse bos sayfa yerine sebep gosterilir (KOD_KURALLARI kural 1).
    enableMocking().then(
      () => setState({ status: "ready" }),
      (error: unknown) => setState({ status: "failed", reason: String(error) }),
    );
  }, []);

  if (state.status === "failed") {
    return (
      <div role="alert" className="space-y-2 p-6 text-sm">
        <p className="font-semibold">Sahte API yüklenemedi.</p>
        <p className="text-muted-foreground">{state.reason}</p>
        <p>
          Geçici olarak kapatmak için <code>frontend/.env.local</code> dosyasına
          <code> NEXT_PUBLIC_API_MOCKING=disabled</code> yazıp <code>npm run dev</code>&apos;i yeniden başlatın.
        </p>
      </div>
    );
  }
  return state.status === "ready" ? children : null;
}
