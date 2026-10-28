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
const RISK_WHAT = "hedef süreyi aşma olasılığı · en riskli üstte";

// Birim detayinda liste yalniz o birimin bildirimleri (department_id)
export function delayRiskSubtitle(departmentId?: number): string {
  return departmentId === undefined
    ? `Açık bildirimlerin ${RISK_WHAT}`
    : `Bu birimin açık bildirimleri · ${RISK_WHAT}`;
}

// Bildirim detayi: bildirim birimin en riskli acik isleri arasindaysa onun satiri. Suresi gecmis, kapanmis ya da
// listeye girmeyecek kadar dusuk riskli bildirimde null (detayda risk gosterilmez)
export function findCaseRisk(data: DelayRiskRead | undefined, caseId: number): DelayRiskItem | null {
  return data?.items.find((item) => item.case_id === caseId) ?? null;
}

// Model var ama liste bos ve gecikenler var: acik islerin hepsinin suresi dolmus
function onlyLate(data: DelayRiskRead): boolean {
  return data.model !== null && data.items.length === 0 && data.already_late > 0;
}

export function delayRiskHeadline(data: DelayRiskRead): string {
  if (onlyLate(data)) {
    return `${data.already_late} bildirim zaten gecikmiş`;
  }
  if (!data.model || data.items.length === 0) {
    return PLAIN_TITLE;
  }
  const high = data.items.filter((item) => item.level === "HIGH").length;
  return high > 0 ? `${high} bildirim yüksek gecikme riskinde` : "Yüksek riskli bildirim yok";
}

// Liste yerine yazilacak metin; liste varsa ya da durumu kirmizi serit anlatiyorsa null.
// Gecikenler varken "riskli bir sey gorunmuyor" denmez
export function delayRiskEmptyText(data: DelayRiskRead): string | null {
  if (!data.model) {
    return data.message ?? "Gecikme riski için yeterli geçmiş yok.";
  }
  if (data.items.length > 0 || data.already_late > 0) {
    return null;
  }
  return "Süresi dolmamış açık bildirim yok; riskli bir şey görünmüyor.";
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

// Modelden bagimsiz: suresi gecenler her durumda soylenir. Liste bossa baska acik is olmadigi da eklenir
export function alreadyLateText(data: DelayRiskRead): string | null {
  if (data.already_late === 0) {
    return null;
  }
  if (onlyLate(data)) {
    return `${data.already_late} bildirimin hedef süresi geçti; süresi dolmamış açık bildirim yok.`;
  }
  return `${data.already_late} bildirimin hedef süresi zaten geçti.`;
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
