import { useEffect, useState } from "react";

// requestIdleCallback olmayan tarayicilarda (Safari) kisa bir bekleme yeterli
const FALLBACK_DELAY_MS = 200;
// Tarayici hic bosa cikmazsa en gec bu kadar sonra baslanir
const IDLE_TIMEOUT_MS = 3_000;

// Ikincil isler (zil taramasi gibi) sayfanin ilk acilisiyla yarismasin: tarayici bosa cikinca true olur
export function useIdleStart(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { requestIdleCallback: requestIdle, cancelIdleCallback: cancelIdle } = globalThis;
    if (typeof requestIdle === "function") {
      const handle = requestIdle(() => setReady(true), { timeout: IDLE_TIMEOUT_MS });
      return () => cancelIdle(handle);
    }
    const timer = globalThis.setTimeout(() => setReady(true), FALLBACK_DELAY_MS);
    return () => globalThis.clearTimeout(timer);
  }, []);
  return ready;
}
