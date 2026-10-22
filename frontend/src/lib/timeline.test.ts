import { describe, expect, it } from "vitest";

import { collapsedTimeline, timelineLabel } from "./timeline";

describe("timelineLabel", () => {
  it.each([
    ["CASE_CREATED", "Bildiriminiz alındı"],
    ["ANALYSIS_STARTED", "Bildiriminiz inceleniyor"],
    ["AI_CLASSIFIED", "Bildiriminiz incelendi"],
    ["ROUTED", "Sorumlu birim belirlendi"],
    ["TASK_CREATED", "İlgili birime yönlendirildi"],
    ["WORK_STARTED", "Görevli çalışmaya başladı"],
    ["WORK_COMPLETED", "Görevli işi tamamladı"],
    ["CASE_CLOSED", "Bildiriminiz kapatıldı"],
  ])("describes %s in plain Turkish", (eventType, label) => {
    expect(timelineLabel(eventType)).toBe(label);
  });

  it("uses a neutral text for an event the screen does not know yet", () => {
    // event_type API'de serbest metin; yeni olay tipi ekrani bozmamali ama gizlenmemeli
    expect(timelineLabel("SOMETHING_NEW")).toBe("Bildiriminiz güncellendi");
  });
});

describe("collapsedTimeline", () => {
  const steps = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

  // Kapaliyken son 3 adim gorunur; gizlenenler sayilir
  it("keeps the latest three steps and counts the earlier ones", () => {
    expect(collapsedTimeline(steps(9), false)).toEqual({ visible: [7, 8, 9], hidden: 6 });
  });

  it("shows every step once opened", () => {
    expect(collapsedTimeline(steps(9), true)).toEqual({ visible: steps(9), hidden: 6 });
  });

  // Bir adim gizlemek icin dugme koymaya degmez
  it("shows a short timeline whole without a toggle", () => {
    expect(collapsedTimeline(steps(4), false)).toEqual({ visible: steps(4), hidden: 0 });
    expect(collapsedTimeline([], false)).toEqual({ visible: [], hidden: 0 });
  });
});
