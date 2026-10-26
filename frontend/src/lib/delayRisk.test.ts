import { describe, expect, it } from "vitest";

import { DELAY_RISK, DELAY_RISK_NO_MODEL } from "@/mocks/analyticsFixtures";

import {
  alreadyLateText,
  aucQuality,
  delayRiskEmptyText,
  delayRiskHeadline,
  elapsedText,
  factorsText,
  LATE_CASES_PATH,
  modelNote,
  riskBadge,
} from "./delayRisk";

const [high, medium, low] = DELAY_RISK.items;

function firstItems() {
  if (!high || !medium || !low) {
    throw new Error("analyticsFixtures.ts DELAY_RISK en az uc satir olmali");
  }
  return { high, medium, low };
}

describe("delayRiskHeadline", () => {
  it("counts the cases at high risk", () => {
    expect(delayRiskHeadline(DELAY_RISK)).toBe("1 bildirim yüksek gecikme riskinde");
  });

  it("says no case is at high risk when the list has only lower risks", () => {
    const calm = { ...DELAY_RISK, items: DELAY_RISK.items.filter((item) => item.level !== "HIGH") };

    expect(delayRiskHeadline(calm)).toBe("Yüksek riskli bildirim yok");
  });

  it("keeps a plain title when there is nothing to list or no model", () => {
    expect(delayRiskHeadline({ ...DELAY_RISK, items: [] })).toBe("Gecikme riski");
    expect(delayRiskHeadline(DELAY_RISK_NO_MODEL)).toBe("Gecikme riski");
  });
});

describe("delayRiskEmptyText", () => {
  it("passes on the backend reason when there is no model", () => {
    expect(delayRiskEmptyText(DELAY_RISK_NO_MODEL)).toBe(DELAY_RISK_NO_MODEL.message);
  });

  it("says nothing is at risk when no open case is still within its target", () => {
    expect(delayRiskEmptyText({ ...DELAY_RISK, items: [] })).toBe(
      "Süresi dolmamış açık bildirim yok; riskli bir şey görünmüyor.",
    );
  });

  it("has no empty text when there are cases to list", () => {
    expect(delayRiskEmptyText(DELAY_RISK)).toBeNull();
  });
});

describe("rows", () => {
  it("labels the risk level with a rounded percentage and a tone", () => {
    const { high: h, medium: m, low: l } = firstItems();

    expect(riskBadge(h)).toEqual({ label: "Yüksek risk · %78", tone: "HIGH" });
    expect(riskBadge(m).label).toBe("Orta risk · %44");
    expect(riskBadge(l).label).toBe("Düşük risk · %18");
  });

  it("does not round a tiny risk down to zero", () => {
    const { low: l } = firstItems();

    expect(riskBadge({ ...l, risk_pct: 0.2 }).label).toBe("Düşük risk · %1'den az");
    expect(riskBadge({ ...l, risk_pct: 0 }).label).toBe("Düşük risk · %1'den az");
    expect(riskBadge({ ...l, risk_pct: 1.4 }).label).toBe("Düşük risk · %1");
  });

  it("writes the used share of the target time without a Turkish suffix", () => {
    expect(elapsedText(62.4)).toBe("Geçen süre %62");
  });

  it("joins the reasons, or leaves them out when there are none", () => {
    const { high: h } = firstItems();

    expect(factorsText(h)).toBe("Neden: Mesai dışında açıldı · Açıldığında birimde 14 açık iş vardı");
    expect(factorsText({ ...h, factors: [] })).toBeNull();
  });
});

describe("already late", () => {
  it("points to the late cases only when some are already past their target", () => {
    expect(alreadyLateText(3)).toBe("3 bildirimin hedef süresi zaten geçti.");
    expect(alreadyLateText(0)).toBeNull();
    expect(LATE_CASES_PATH).toBe("/manager/cases?group=late");
  });
});

describe("model note", () => {
  it("grades the measured accuracy in plain words", () => {
    expect(aucQuality(0.85)).toBe("iyi");
    expect(aucQuality(0.65)).toBe("orta");
    expect(aucQuality(0.49)).toBe("zayıf; tahminleri ihtiyatla kullanın");
  });

  it("says how the model was measured and that the decision stays with the manager", () => {
    expect(modelNote({ train_cases: 347, test_cases: 149, auc: 0.85, late_share_pct: 22.8 })).toBe(
      "Model 347 kapanmış bildirimle eğitildi, en yeni 149 bildirimde sınandı: AUC 0,85 (iyi). " +
        "Tahmin bir uyarıdır; karar sizindir.",
    );
  });

  it("says when the accuracy could not be measured", () => {
    expect(modelNote({ train_cases: 40, test_cases: 12, auc: null, late_share_pct: 10 })).toBe(
      "Model 40 kapanmış bildirimle eğitildi; doğruluğu ölçülemedi. Tahmin bir uyarıdır; karar sizindir.",
    );
  });
});
