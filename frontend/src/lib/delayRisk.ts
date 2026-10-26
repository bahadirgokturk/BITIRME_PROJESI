// Gecikme riski karti (docs/UI_GUIDE.md bolum 5.4, docs/ANALYTICS.md "Gecikme riski"): acik bildirimlerin
// hedef sureyi asma olasiligi. Sayilar backend'den gelir; burada yalniz ekran metinleri kurulur.
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type DelayRiskRead = Schemas["DelayRiskRead"];
export type DelayRiskItem = Schemas["DelayRiskItem"];
export type DelayRiskLevel = Schemas["DelayRiskLevel"];
type DelayRiskModel = Schemas["DelayRiskModelInfo"];

// Suresi gecmis bildirimler Tum Bildirimler'de "Geciken" grubuyla acilir (lib/caseList.ts STATUS_GROUPS)
export const LATE_CASES_PATH = "/manager/cases?group=late";

const LEVEL_LABELS: Record<DelayRiskLevel, string> = {
  HIGH: "Yüksek risk",
  MEDIUM: "Orta risk",
  LOW: "Düşük risk",
};

const PLAIN_TITLE = "Gecikme riski";

export function delayRiskHeadline(data: DelayRiskRead): string {
  if (!data.model || data.items.length === 0) {
    return PLAIN_TITLE;
  }
  const high = data.items.filter((item) => item.level === "HIGH").length;
  return high > 0 ? `${high} bildirim yüksek gecikme riskinde` : "Yüksek riskli bildirim yok";
}

// Liste yerine yazilacak metin; liste varsa null
export function delayRiskEmptyText(data: DelayRiskRead): string | null {
  if (!data.model) {
    return data.message ?? "Gecikme riski için yeterli geçmiş yok.";
  }
  return data.items.length === 0 ? "Süresi dolmamış açık bildirim yok; riskli bir şey görünmüyor." : null;
}

// Olasilik hic tam sifir degildir: %1'in altindaki deger "%0" diye yuvarlanmaz
const MIN_SHOWN_PCT = 1;

function riskPercent(riskPct: number): string {
  return riskPct < MIN_SHOWN_PCT ? `%${MIN_SHOWN_PCT}'den az` : `%${Math.round(riskPct)}`;
}

export function riskBadge(item: DelayRiskItem): { label: string; tone: DelayRiskLevel } {
  return { label: `${LEVEL_LABELS[item.level]} · ${riskPercent(item.risk_pct)}`, tone: item.level };
}

// Ek yok: "%62'si / %35'i" sayiya gore degisir, eksiz yazilir
export function elapsedText(elapsedPct: number): string {
  return `Geçen süre %${Math.round(elapsedPct)}`;
}

export function factorsText(item: DelayRiskItem): string | null {
  return item.factors.length > 0 ? `Neden: ${item.factors.map((factor) => factor.label).join(" · ")}` : null;
}

export function alreadyLateText(count: number): string | null {
  return count > 0 ? `${count} bildirimin hedef süresi zaten geçti.` : null;
}

// ROC-AUC'nin yaygin yorumu: 0,5 yazi tura, 0,7 ve ustu kullanisli, 0,6-0,7 sinirda
const AUC_GOOD = 0.7;
const AUC_FAIR = 0.6;
const AUC_DIGITS = 2;

export function aucQuality(auc: number): string {
  if (auc >= AUC_GOOD) {
    return "iyi";
  }
  return auc >= AUC_FAIR ? "orta" : "zayıf; tahminleri ihtiyatla kullanın";
}

const DECISION_NOTE = "Tahmin bir uyarıdır; karar sizindir.";

// Modelin durust olcumu: eski bildirimlerle egitildi, en yenilerde sinandi (backend zaman sirali bolme)
export function modelNote(model: DelayRiskModel): string {
  const trained = `Model ${model.train_cases} kapanmış bildirimle eğitildi`;
  if (model.auc === null) {
    return `${trained}; doğruluğu ölçülemedi. ${DECISION_NOTE}`;
  }
  const auc = model.auc.toFixed(AUC_DIGITS).replace(".", ",");
  const tested = `en yeni ${model.test_cases} bildirimde sınandı: AUC ${auc} (${aucQuality(model.auc)})`;
  return `${trained}, ${tested}. ${DECISION_NOTE}`;
}
