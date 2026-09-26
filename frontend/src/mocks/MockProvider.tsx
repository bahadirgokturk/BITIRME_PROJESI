"use client";

import { useEffect, useState, type ReactNode } from "react";

// .env.development: NEXT_PUBLIC_API_MOCKING=enabled iken uygulanmamis endpoint'ler sahte cevap alir
const MOCKING_ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

// React gelistirme modunda effect'ler iki kez calisir; worker yalniz bir kez baslatilmali
let workerStarted: Promise<unknown> | null = null;

function startWorker(): Promise<unknown> {
  workerStarted ??= import("./browser").then(({ worker }) =>
    worker.start({ onUnhandledRequest: "bypass", quiet: true }),
  );
  return workerStarted;
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
    // Worker hazir olmadan istek atilirsa gercek backend'e gider (501); once worker baslatilir.
    // Baslatilamazsa bos sayfa yerine sebep gosterilir (KOD_KURALLARI kural 1).
    startWorker().then(
      () => setState({ status: "ready" }),
      (error: unknown) => setState({ status: "failed", reason: String(error) }),
    );
  }, []);

  if (state.status === "failed") {
    return (
      <div role="alert" className="space-y-2 p-6 text-sm">
        <p className="font-semibold">Sahte API (MSW) başlatılamadı.</p>
        <p className="text-muted-foreground">{state.reason}</p>
        <p>
          Tarayıcı service worker desteklemiyor olabilir. Chrome/Firefox/Safari ile açın ya da
          <code> frontend/.env.local</code> dosyasına <code>NEXT_PUBLIC_API_MOCKING=disabled</code> yazın.
        </p>
      </div>
    );
  }
  return state.status === "ready" ? children : null;
}
