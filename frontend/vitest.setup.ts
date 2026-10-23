import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { markServerReachable } from "@/lib/api/reachability";
import { server } from "@/mocks/node";

// jsdom'da matchMedia yok (tum tarayicilarda var); media sorgulari "eslesmiyor" doner
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Testler uygulamayla ayni sahte handler'lari kullanir; tanimsiz istek testi kirmizi yapar
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  // Ag hatasi taklit eden test "sunucuya ulasilamiyor" durumunu sonraki teste tasimasin
  markServerReachable(true);
});
afterAll(() => server.close());
