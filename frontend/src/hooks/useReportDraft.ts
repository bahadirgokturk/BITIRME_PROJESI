"use client";

import { useEffect, useState } from "react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { isBlankDraft, parseReportDraft, REPORT_DRAFT_PREFIX, reportDraftKey, type ReportDraft } from "@/lib/reportDraft";

// Her tus vurusunda yazmamak icin kisa bekleme; yarim saniyede cikip gitmek pek olmaz
const DRAFT_SAVE_DELAY_MS = 500;

// Gizli sekme ya da engellenmis site verisi: taslak bu oturumda calismaz, form yine de kullanilir
function withStorage<T>(run: (storage: Storage) => T, fallback: T): T {
  try {
    return run(window.localStorage);
  } catch (error) {
    if (!(error instanceof DOMException)) {
      throw error;
    }
    return fallback;
  }
}

export function readReportDraft(key: string | null): ReportDraft | null {
  if (key === null) {
    return null;
  }
  const draft = parseReportDraft(withStorage((storage) => storage.getItem(key), null));
  return draft && !isBlankDraft(draft) ? draft : null;
}

export function clearReportDraft(key: string | null): void {
  if (key !== null) {
    withStorage((storage) => storage.removeItem(key), undefined);
  }
}

// Cikista cagrilir: ortak kullanilan bir cihazda sonraki kisi taslagi gormesin
export function clearReportDrafts(): void {
  withStorage((storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? "");
    keys.filter((key) => key.startsWith(REPORT_DRAFT_PREFIX)).forEach((key) => storage.removeItem(key));
  }, undefined);
}

// Taslak anahtari form acilirken bir kez belirlenir. Kullanici kabuk tarafindan zaten yuklendigi icin
// onbellektedir; yoksa (ornegin testte) taslak kapali kalir.
export function useReportDraftKey(): string | null {
  const { data: user } = useCurrentUser();
  const [key] = useState(() => (user ? reportDraftKey(user.id) : null));
  return key;
}

// Form degistikce taslak yazilir; bos form taslagi siler. Metin olarak beklenir: her cizimde yeni nesne
// olusur, metin ise ayni kaldikca degismis sayilmaz (gereksiz yazma ve yeniden cizim olmaz)
export function useSaveReportDraft(key: string | null, draft: ReportDraft): void {
  const settled = useDebouncedValue(JSON.stringify(draft), DRAFT_SAVE_DELAY_MS);
  useEffect(() => {
    if (key === null) {
      return;
    }
    if (isBlankDraft(JSON.parse(settled) as ReportDraft)) {
      clearReportDraft(key);
      return;
    }
    withStorage((storage) => storage.setItem(key, settled), undefined);
  }, [key, settled]);
}
