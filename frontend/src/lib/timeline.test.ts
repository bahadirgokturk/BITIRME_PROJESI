import { describe, expect, it } from "vitest";

import { timelineLabel } from "./timeline";

describe("timelineLabel", () => {
  it.each([
    ["CASE_CREATED", "Bildiriminiz alındı"],
    ["ANALYSIS_STARTED", "Bildiriminiz inceleniyor"],
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
