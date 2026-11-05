"use client";

import { useSyncExternalStore } from "react";

import { parseSidebarOpen, SIDEBAR_KEY, type SidebarState } from "@/lib/shell";
import { withStorage } from "@/lib/storage";

// Ayni sekmedeki dinleyicilere secimin degistigini soyler ("storage" olayi yalniz diger sekmelere gider)
const CHANGE_EVENT = "bakircayflow-sidebar-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Masaustu kenar cubugu acik mi; secim cihazda hatirlanir, sunucuda acik varsayilir
export function useSidebarOpen(): [boolean, () => void] {
  const open = useSyncExternalStore(
    subscribe,
    () => parseSidebarOpen(withStorage((storage) => storage.getItem(SIDEBAR_KEY), null)),
    () => true,
  );
  const toggle = () => {
    const next: SidebarState = open ? "closed" : "open";
    withStorage((storage) => storage.setItem(SIDEBAR_KEY, next), undefined);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [open, toggle];
}
