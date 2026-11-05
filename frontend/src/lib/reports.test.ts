import { describe, expect, it } from "vitest";

import {
  agingHeadline,
  agingNote,
  bottleneckHeadline,
  busiestDepartmentHeadline,
  busiestLocationHeadline,
  formatDecimal,
  isBottleneck,
  locationRows,
  processMapHeadline,
  processMapSubtitle,
  recurringHeadline,
  recurringSubtitle,
  recurringTrend,
  slaHeadline,
  slaRows,
  slaSummary,
  slowestCategoryHeadline,
  variantRows,
  waitRows,
  type DepartmentPerformance,
  type LocationsRead,
  type ProcessMapRead,
  type ProcessRead,
  type ResolutionTimeRow,
  type SlaRead,
} from "./reports";

const building = (id: number, name: string) => ({ id, kind: "BUILDING" as const, name, path: name });

const locations: LocationsRead = {
  level: "building",
  items: [
    { location: building(2, "A Blok"), count: 14, by_category: { TECHNICAL: 9, CLEANING: 5 } },
    { location: building(1, "B Blok"), count: 21, by_category: { CLEANING: 12, CONSUMABLE: 9 } },
  ],
};

const sla: SlaRead = {
  with_sla: 20,
  met: 17,
  breached: 3,
  compliance_pct: 85,
  by_priority: [
    { priority: "LOW", with_sla: 0, met: 0, breached: 0, compliance_pct: null },
    { priority: "CRITICAL", with_sla: 5, met: 4, breached: 1, compliance_pct: 80 },
    { priority: "HIGH", with_sla: 15, met: 13, breached: 2, compliance_pct: 86.7 },
  ],
};

const step = (from: string, label: string, median: number | null) => ({
  from_event: from,
  to_event: `${from}_NEXT`,
  label,
  count: 10,
  avg_min: median,
  median_min: median,
});

describe("formatDecimal", () => {
  it("writes one decimal the Turkish way and a dash without data", () => {
    expect(formatDecimal(4.5)).toBe("4,5");
    expect(formatDecimal(3)).toBe("3");
    expect(formatDecimal(1.26)).toBe("1,3");
    expect(formatDecimal(null)).toBe("–");
  });
});

describe("locations", () => {
  it("names the busiest building", () => {
    expect(busiestLocationHeadline(locations)).toBe("En yoğun bina: B Blok (21 bildirim)");
    expect(busiestLocationHeadline({ level: "building", items: [] })).toBe("Bina yoğunluğu");
  });

  it("sorts buildings by load and names the top category of each", () => {
    expect(locationRows(locations)).toEqual([
      { id: 1, name: "B Blok", count: 21, percent: 100, hint: "En çok: Temizlik" },
      { id: 2, name: "A Blok", count: 14, percent: 67, hint: "En çok: Teknik" },
    ]);
  });
});

describe("sla", () => {
  it("says how much was solved in time", () => {
    expect(slaHeadline(sla)).toBe("Zamanında çözülen: %85");
    expect(slaHeadline({ ...sla, compliance_pct: null })).toBe("Zamanında çözülen");
    expect(slaSummary(sla)).toBe("20 bildirimden 17 tanesi zamanında çözüldü, 3 tanesi gecikti.");
  });

  it("lists priorities from critical to low and skips the ones without a target time", () => {
    expect(slaRows(sla)).toEqual([
      { priority: "CRITICAL", label: "Kritik", value: "%80", percent: 80, hint: "5 işten 4 tanesi zamanında" },
      { priority: "HIGH", label: "Yüksek", value: "%87", percent: 87, hint: "15 işten 13 tanesi zamanında" },
    ]);
  });
});

describe("resolution times", () => {
  const row = (label: string, median: number | null): ResolutionTimeRow => ({
    category: "OTHER",
    label,
    count: 4,
    avg_min: median,
    median_min: median,
    p90_min: median,
  });

  it("names the slowest category by its typical time", () => {
    expect(slowestCategoryHeadline([row("Temizlik", 110), row("Teknik", 420), row("Diğer", null)])).toBe(
      "En uzun süren: Teknik (tipik 7 sa)",
    );
    expect(slowestCategoryHeadline([row("Diğer", null)])).toBe("Çözüm süreleri");
    expect(slowestCategoryHeadline([])).toBe("Çözüm süreleri");
  });
});

describe("aging", () => {
  const buckets = [
    { label: "0-2 sa", min_hours: 0, max_hours: 2, count: 14 },
    { label: "24+ sa", min_hours: 24, max_hours: null, count: 4 },
  ];

  it("counts what is waiting and warns about the oldest ones", () => {
    expect(agingHeadline({ total_open: 18, buckets })).toBe("18 bildirim bekliyor");
    expect(agingHeadline({ total_open: 0, buckets: [] })).toBe("Bekleyen bildirim yok");
    expect(agingNote({ total_open: 18, buckets })).toBe("4 bildirim 24 saatten uzun süredir açık.");
    expect(agingNote({ total_open: 14, buckets: [buckets[0]!, { ...buckets[1]!, count: 0 }] })).toBeNull();
  });
});

describe("departments", () => {
  const department = (name: string, perStaff: number | null): DepartmentPerformance => ({
    department: { id: name.length, code: name, name },
    cases: 10,
    avg_resolution_min: 100,
    median_resolution_min: 90,
    sla_compliance_pct: 90,
    open_tasks: 9,
    active_staff: 3,
    open_tasks_per_staff: perStaff,
  });

  it("names the unit with the most open work per person", () => {
    expect(busiestDepartmentHeadline([department("Destek Hizmetleri", 1.5), department("Bakım Onarım", 4.5)])).toBe(
      "En yoğun birim: Bakım Onarım (kişi başı 4,5 açık görev)",
    );
    expect(busiestDepartmentHeadline([department("Beslenme", null)])).toBe("Birim performansı");
  });
});

describe("recurring problems", () => {
  it("counts them and explains the rule", () => {
    expect(recurringHeadline(3)).toBe("3 sorun tekrar ediyor");
    expect(recurringHeadline(0)).toBe("Tekrar eden sorun yok");
    expect(recurringSubtitle({ threshold: 5, window_days: 30 })).toBe(
      "Son 30 günde aynı yerde 5 ve daha fazla kez bildirilenler",
    );
  });

  it("treats a rising problem as bad and a falling one as good", () => {
    expect(recurringTrend("up")).toEqual({ text: "▲ Artıyor", tone: "bad" });
    expect(recurringTrend("down")).toEqual({ text: "▼ Azalıyor", tone: "good" });
    expect(recurringTrend("flat")).toEqual({ text: "Değişmedi", tone: "none" });
  });
});

describe("process", () => {
  const slow = step("TASK_CREATED", "Atamadan kabule", 42);
  const process: ProcessRead = { steps: [step("CASE_CREATED", "Bildirimden atamaya", 4), slow], bottleneck: slow };

  it("names the slowest step", () => {
    expect(bottleneckHeadline(process)).toBe("En yavaş adım: Atamadan kabule");
    expect(bottleneckHeadline({ steps: [], bottleneck: null })).toBe("Süreç adımları");
  });

  it("marks only the bottleneck step", () => {
    expect(isBottleneck(process.steps[1]!, process)).toBe(true);
    expect(isBottleneck(process.steps[0]!, process)).toBe(false);
    expect(isBottleneck(process.steps[0]!, { ...process, bottleneck: null })).toBe(false);
  });
});

describe("process map", () => {
  const variant = (labels: string[], count: number, share_pct: number | null, median_total_min: number | null) => ({
    steps: labels,
    labels,
    count,
    share_pct,
    median_total_min,
  });
  const edge = (source_label: string, target_label: string, count: number, median_min: number | null) => ({
    source: source_label,
    target: target_label,
    source_label,
    target_label,
    count,
    median_min,
  });
  const map: ProcessMapRead = {
    case_count: 262,
    activities: [],
    variants: [
      variant(["Bildirim açıldı", "Görev oluşturuldu", "Kapatıldı"], 150, 57.3, 48),
      variant(["Bildirim açıldı", "Yöneticiye iletildi"], 26, 9.9, 5665.5),
      variant(["Bildirim açıldı", "Reddedildi"], 9, 3.4, null),
    ],
    edges: [
      edge("Görev oluşturuldu", "Görev kabul edildi", 195, 20),
      edge("Görev oluşturuldu", "Yöneticiye iletildi", 58, 5612),
      edge("Bilgi istendi", "Reddedildi", 2, 5622),
      edge("İş tamamlandı", "Kapatıldı", 214, null),
    ],
  };
  const empty: ProcessMapRead = { case_count: 0, activities: [], variants: [], edges: [] };

  it("headlines the most common path with its share and typical time", () => {
    expect(processMapHeadline(map)).toBe("En sık yol: %57 bildirim (tipik 48 dk)");
    expect(processMapHeadline(empty)).toBe("Süreç haritası");
    expect(processMapSubtitle(map)).toBe("Dönemde açılan 262 bildirimin izlediği yollar ve adımlar arasındaki bekleme");
  });

  it("writes each path as steps with arrows and marks the slowest one", () => {
    const rows = variantRows(map);

    expect(rows[0]).toMatchObject({
      label: "Bildirim açıldı → Görev oluşturuldu → Kapatıldı",
      value: "%57",
      percent: 57.3,
      hint: "150 bildirim · tipik 48 dk",
      tone: "primary",
    });
    expect(rows[1]).toMatchObject({ badge: "En uzun", tone: "warning", hint: "26 bildirim · tipik 3 gün" });
    expect(rows[2]).toMatchObject({ hint: "9 bildirim", badge: undefined });
  });

  it("does not single out a path when there is only one", () => {
    expect(variantRows({ ...map, variants: map.variants.slice(0, 1) })[0]?.badge).toBeUndefined();
  });

  // Seyrek gecis (2 kez) tek bir uzun bekleme yuzunden darbogaz gibi gorunmesin
  it("lists the waits between steps longest first and leaves out rare or unmeasured steps", () => {
    const rows = waitRows(map);

    expect(rows.map((row) => row.label)).toEqual([
      "Görev oluşturuldu → Yöneticiye iletildi",
      "Görev oluşturuldu → Görev kabul edildi",
    ]);
    expect(rows[0]).toMatchObject({ value: "3 gün", hint: "58 kez", badge: "Darboğaz", tone: "warning", percent: 100 });
    expect(rows[1]).toMatchObject({ value: "20 dk", hint: "195 kez", badge: undefined, tone: "primary" });
    expect(waitRows(empty)).toEqual([]);
  });
});
