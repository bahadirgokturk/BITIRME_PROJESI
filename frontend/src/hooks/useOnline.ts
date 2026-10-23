"use client";

import { useSyncExternalStore } from "react";

import { isServerReachable, subscribeReachability } from "@/lib/api/reachability";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  const stopReachability = subscribeReachability(onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
    stopReachability();
  };
}

// Bagli sayilmak icin hem tarayici "bagliyim" demeli hem de son istek sunucuya ulasmis olmali.
// Sunucuda bilinmez, bagli varsayilir (serit ilk cizimde gorunmesin)
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine && isServerReachable(), () => true);
}

// Yalniz istekler dustugu icin "bagli degil" durumu (tarayici hala bagli diyor)
export function useServerUnreachable(): boolean {
  return useSyncExternalStore(subscribeReachability, () => !isServerReachable(), () => false);
}
