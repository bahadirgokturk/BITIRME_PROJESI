// Saglik durumunun kullaniciya gosterimi; durum hem renk hem metinle verilir (erisilebilirlik)
import { ApiError } from "@/lib/api/client";

export type HealthTone = "ok" | "error" | "unknown";

export interface HealthLine {
  label: string;
  tone: HealthTone;
}

export interface HealthView {
  backend: HealthLine;
  database: HealthLine;
}

const BACKEND_UP: HealthLine = { label: "Backend çalışıyor", tone: "ok" };

export function describeHealth(error: unknown): HealthView {
  // 503 = backend ayakta ama DB yok; diger hatalar backend'e hic ulasilamadigini gosterir
  if (error === null) {
    return { backend: BACKEND_UP, database: { label: "Veritabanı bağlı", tone: "ok" } };
  }
  if (error instanceof ApiError && error.status === 503) {
    return {
      backend: BACKEND_UP,
      database: { label: "Veritabanına ulaşılamıyor", tone: "error" },
    };
  }
  return {
    backend: { label: "Backend'e ulaşılamıyor", tone: "error" },
    database: { label: "Veritabanı durumu bilinmiyor", tone: "unknown" },
  };
}
