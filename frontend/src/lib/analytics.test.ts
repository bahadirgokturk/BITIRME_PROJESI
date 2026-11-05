import { describe, expect, it } from "vitest";

import { KPIS_WEEK } from "@/mocks/analyticsFixtures";

import {
  barPercent,
  bucketLabel,
  deltaView,
  formatCount,
  formatMinutes,
  formatPercent,
  kpiCards,
  periodRange,
  topCategoryHeadline,
  trendHeadline,
} from "./analytics";

describe("formatting", () => {
  it("writes minutes as hours and minutes", () => {
    expect(formatMinutes(42)).toBe("42 dk");
    // Dakikanin altindaki sure "0 dk" degil (is bir dakikadan kisa surdu)
    expect(formatMinutes(0.3)).toBe("1 dk'dan kısa");
    expect(formatMinutes(0)).toBe("1 dk'dan kısa");
    expect(formatMinutes(300)).toBe("5 sa");
    expect(formatMinutes(310)).toBe("5 sa 10 dk");
    expect(formatMinutes(2900)).toBe("2 gün");
  });

  it("writes percentages the Turkish way, rounded", () => {
    expect(formatPercent(91.4)).toBe("%91");
    expect(formatPercent(0)).toBe("%0");
  });

  it("shows a dash when there is no data", () => {
    expect(formatMinutes(null)).toBe("–");
    expect(formatPercent(null)).toBe("–");
    expect(formatCount(null)).toBe("–");
    expect(formatCount(42)).toBe("42");
  });
});

describe("deltaView", () => {
  it("judges a change by whether it is good, not by its direction", () => {
    expect(deltaView(12, "lower")).toEqual({ text: "▲ %12", tone: "bad" });
    expect(deltaView(-8, "lower")).toEqual({ text: "▼ %8", tone: "good" });
    expect(deltaView(3.4, "higher")).toEqual({ text: "▲ %3", tone: "good" });
    expect(deltaView(-5, "higher")).toEqual({ text: "▼ %5", tone: "bad" });
  });

  it("stays neutral for counts that are neither good nor bad", () => {
    expect(deltaView(-10, "none")).toEqual({ text: "▼ %10", tone: "none" });
  });

  it("says so when nothing changed or the previous period has no data", () => {
    expect(deltaView(0, "higher")).toEqual({ text: "Değişmedi", tone: "none" });
    expect(deltaView(null, "higher")).toEqual({ text: "–", tone: "none" });
  });
});

describe("kpiCards", () => {
  it("builds the six dashboard cards from the backend numbers", () => {
    const cards = kpiCards(KPIS_WEEK);

    expect(cards.map((card) => card.label)).toEqual([
      "Açık Bildirim",
      "SLA Uyumu",
      "Ortalama Çözüm Süresi",
      "Otomasyon Oranı",
      "Bugün Açılan",
      "Müdür İncelemesi Oranı",
    ]);
    expect(cards[0]).toMatchObject({ value: "42", delta: { text: "▲ %12", tone: "bad" } });
    expect(cards[2]).toMatchObject({ value: "5 sa 10 dk", delta: { text: "▼ %8", tone: "good" } });
    expect(cards[5]).toMatchObject({ value: "%14", delta: { text: "–", tone: "none" } });
  });

  // Onceki donem cok kucukken yuzde anlamsiz buyur ("%2000"); fark kartin kendi biriminde yazilir
  it("writes a very large change as the difference itself", () => {
    const cards = kpiCards({
      ...KPIS_WEEK,
      open_cases: { value: 42, previous: 2, delta_pct: 2000 },
      human_review_pct: { value: 23, previous: 10.7, delta_pct: 114.9 },
      avg_resolution_min: { value: 180, previous: 50, delta_pct: 260 },
    });

    expect(cards[0]!.delta).toEqual({ text: "▲ 40", tone: "bad" });
    expect(cards[5]!.delta).toEqual({ text: "▲ 12 puan", tone: "bad" });
    expect(cards[2]!.delta).toEqual({ text: "▲ 2 sa 10 dk", tone: "bad" });
  });

  it("links each card to the screen that explains it, only where the role can go", () => {
    const manager = kpiCards(KPIS_WEEK, "MANAGER").map((card) => card.href);
    const admin = kpiCards(KPIS_WEEK, "ADMIN").map((card) => card.href);

    expect(manager).toEqual([
      "/manager/cases?group=open",
      "/manager/cases?group=late",
      "/manager/analytics",
      "/manager/agents",
      "/manager/cases",
      "/manager/review-queue",
    ]);
    // Inceleme kuyrugu yalniz mudurde var
    expect(admin.at(-1)).toBeNull();
    expect(admin[0]).toBe("/manager/cases?group=open");
    // Rol verilmezse (birim detayi) kartlar baglanti degil
    expect(kpiCards(KPIS_WEEK).every((card) => card.href === null)).toBe(true);
  });

  it("keeps the percentage while the change stays readable", () => {
    const cards = kpiCards({ ...KPIS_WEEK, open_cases: { value: 20, previous: 10, delta_pct: 100 } });

    expect(cards[0]!.delta).toEqual({ text: "▲ %100", tone: "bad" });
  });
});

describe("periodRange", () => {
  it("covers the last 7 or 30 days in Istanbul time, today included", () => {
    const now = new Date("2026-10-07T21:30:00Z"); // Istanbul'da 8 Ekim 00:30

    expect(periodRange("7d", now)).toEqual({ from: "2026-10-02", to: "2026-10-08" });
    expect(periodRange("30d", now)).toEqual({ from: "2026-09-09", to: "2026-10-08" });
  });
});

describe("chart helpers", () => {
  const points = [
    { bucket: "2026-10-05", opened: 8, closed: 6 },
    { bucket: "2026-10-06", opened: 11, closed: 9 },
  ];

  it("answers the question in the trend title", () => {
    expect(trendHeadline(points)).toBe("19 bildirim açıldı, 15 bildirim kapandı");
    expect(trendHeadline([])).toBe("Bu dönemde bildirim yok");
    expect(trendHeadline([{ bucket: "2026-10-05", opened: 0, closed: 0 }])).toBe("Bu dönemde bildirim yok");
  });

  it("names the busiest category with its share", () => {
    const categories = {
      total: 64,
      items: [
        { category: "TECHNICAL" as const, label: "Teknik arıza", count: 15, case_types: [] },
        { category: "CLEANING" as const, label: "Temizlik", count: 26, case_types: [] },
      ],
    };

    expect(topCategoryHeadline(categories)).toBe("En çok sorun: Temizlik (%41)");
    expect(topCategoryHeadline({ total: 0, items: [] })).toBe("Kategori dağılımı");
  });

  it("labels a bucket by weekday for days and by date for weeks", () => {
    expect(bucketLabel("2026-10-05", "day")).toBe("Pzt");
    expect(bucketLabel("2026-10-05", "week")).toBe("5 Eki");
  });

  it("scales a bar against the largest value", () => {
    expect(barPercent(7, 14)).toBe(50);
    expect(barPercent(0, 14)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
  });
});
