"use client";

import { useSyncExternalStore } from "react";

import { listViewKey, parseListView, type ListName, type ListView } from "@/lib/listTools";
import { withStorage } from "@/lib/storage";

// Ayni sekmedeki dinleyicilere secimin degistigini soyler ("storage" olayi yalniz diger sekmelere gider)
const CHANGE_EVENT = "bakircayflow-list-view-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Liste ya da kart secimi cihazda hatirlanir; sunucuda bilinmez, liste varsayilir
export function useListView(list: ListName): [ListView, (view: ListView) => void] {
  const key = listViewKey(list);
  const view = useSyncExternalStore(
    subscribe,
    () => parseListView(withStorage((storage) => storage.getItem(key), null)),
    (): ListView => "list",
  );
  const setView = (next: ListView) => {
    withStorage((storage) => storage.setItem(key, next), undefined);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [view, setView];
}
