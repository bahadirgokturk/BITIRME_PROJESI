// Sahte API'yi service worker olmadan, istek aninda uygular. Service worker tarayici tarafindan
// bosta kapatilinca hangi sekmenin taklit edildigini unutuyordu; bu yol o sorunu hic yasamaz.
import { getResponse, type RequestHandler } from "msw";

import type { Transport } from "@/lib/api/client";

export function mockTransport(handlers: RequestHandler[]): Transport {
  return async (request) => {
    // getResponse govdeyi okuyabilir; gercek istege giderken orijinal istek bozulmasin
    const mocked = await getResponse(handlers, request.clone());
    return mocked ?? fetch(request);
  };
}
