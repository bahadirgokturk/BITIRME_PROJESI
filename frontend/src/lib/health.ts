// Saglik durumunun kullaniciya gosterimi; durum hem renk hem metinle verilir (erisilebilirlik)
import { ApiError } from "@/lib/api/client";

export type HealthTone = "ok" | "warning" | "error";

export interface HealthView {
  tone: HealthTone;
  backend: string;
  database: string;
}

const HEALTHY: HealthView = { tone: "ok", backend: "Backend çalışıyor", database: "Veritabanı bağlı" };
const DB_DOWN: HealthView = {
  tone: "warning",
  backend: "Backend çalışıyor",
  database: "Veritabanına ulaşılamıyor",
};

export function describeHealth(error: unknown): HealthView {
  // 503 = backend ayakta ama DB yok; diger hatalar backend'e hic ulasilamadigini gosterir
  if (error === null) {
    return HEALTHY;
  }
  if (error instanceof ApiError && error.status === 503) {
    return DB_DOWN;
  }
  return { tone: "error", backend: "Backend'e ulaşılamıyor", database: "Bilinmiyor" };
}
