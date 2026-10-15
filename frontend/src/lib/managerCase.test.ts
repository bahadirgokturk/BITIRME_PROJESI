import { describe, expect, it } from "vitest";

import type { components } from "@/lib/api/types";

import { awaitsManager, caseInfoFields, eventActor, managerEventLabel, photoList } from "./managerCase";

type Schemas = components["schemas"];
type CaseRead = Schemas["CaseRead"];
type CaseEvent = Schemas["CaseEventRead"];

function caseItem(overrides: Partial<CaseRead>): CaseRead {
  return {
    id: 301,
    case_number: "CASE-000301",
    title: "Sabun bitmiş",
    description: "Sabunluklar boş.",
    status: "ASSIGNED",
    location: { id: 5, kind: "WC", name: "B Blok Zemin Kat WC", path: "KMP/B/0/WC" },
    reporter_id: 9,
    case_type: { id: 1, code: "SOAP_EMPTY", name: "Sabun bitti" },
    category: "CONSUMABLE",
    department: { id: 1, code: "SUPPORT_SERVICES", name: "Destek Hizmetleri Şube Müdürlüğü" },
    priority: "LOW",
    needs_human_review: false,
    parent_case_id: null,
    duplicate_count: 0,
    reopened_count: 0,
    satisfaction_rating: null,
    info_request: null,
    created_at: "2026-10-13T07:42:00Z",
    assigned_at: "2026-10-13T07:42:01Z",
    resolved_at: null,
    closed_at: null,
    due_at: "2026-10-13T11:42:00Z",
    sla_status: "ON_TRACK",
    ...overrides,
  };
}

function event(overrides: Partial<CaseEvent>): CaseEvent {
  return {
    id: 1,
    event_type: "CASE_CREATED",
    actor_type: "USER",
    actor_id: 9,
    agent_name: null,
    from_status: null,
    to_status: "NEW",
    occurred_at: "2026-10-13T07:42:00Z",
    metadata: {},
    ...overrides,
  };
}

const labels = (item: CaseRead) => caseInfoFields(item).map((field) => field.label);
const valueOf = (item: CaseRead, label: string) => caseInfoFields(item).find((field) => field.label === label)?.value;

describe("caseInfoFields", () => {
  it("lists what the manager needs for an open case and leaves out what has not happened yet", () => {
    const item = caseItem({});
    expect(labels(item)).toEqual(["Açıklama", "Konum", "Tür", "Birim", "Açılış", "Hedef süre"]);
    expect(valueOf(item, "Tür")).toBe("Sabun bitti · Sarf malzemesi");
    expect(valueOf(item, "Birim")).toBe("Destek Hizmetleri Şube Müdürlüğü");
  });

  it("says so when the type or the unit is not decided yet", () => {
    const item = caseItem({ case_type: null, category: null, department: null, due_at: null });
    expect(valueOf(item, "Tür")).toBe("Henüz belirlenmedi");
    expect(valueOf(item, "Birim")).toBe("Henüz belirlenmedi");
    expect(labels(item)).not.toContain("Hedef süre");
  });

  it("adds closing facts, the rating and repeat counts when they exist", () => {
    const item = caseItem({
      status: "CLOSED",
      resolved_at: "2026-10-13T08:10:00Z",
      closed_at: "2026-10-13T08:11:00Z",
      satisfaction_rating: 4,
      duplicate_count: 3,
      reopened_count: 1,
    });
    expect(labels(item)).toEqual([
      "Açıklama",
      "Konum",
      "Tür",
      "Birim",
      "Açılış",
      "Hedef süre",
      "Çözüm",
      "Kapanış",
      "Bildirenin puanı",
      "Aynı sorunu bildirenler",
      "Yeniden açılma",
    ]);
    expect(valueOf(item, "Bildirenin puanı")).toBe("4 / 5");
    expect(valueOf(item, "Aynı sorunu bildirenler")).toBe("3 bildirim daha");
    expect(valueOf(item, "Yeniden açılma")).toBe("1 kez");
  });
});

describe("managerEventLabel", () => {
  it("names the step in plain words", () => {
    expect(managerEventLabel(event({}))).toBe("Bildirim açıldı");
    expect(managerEventLabel(event({ event_type: "TASK_CREATED" }))).toBe("Görev açıldı");
    expect(managerEventLabel(event({ event_type: "ESCALATED" }))).toBe("Yöneticiye iletildi");
    expect(managerEventLabel(event({ event_type: "DECISION_OVERRIDDEN" }))).toBe("Yapay zekâ kararı düzeltildi");
  });

  it("adds the detail the event carries", () => {
    expect(managerEventLabel(event({ event_type: "FEEDBACK_SUBMITTED", metadata: { rating: 5 } }))).toBe(
      "Bildiren 5 puan verdi",
    );
    expect(
      managerEventLabel(event({ event_type: "CASE_MERGED", metadata: { merged_case_number: "CASE-000526" } })),
    ).toBe("CASE-000526 bu bildirimle birleştirildi");
    expect(managerEventLabel(event({ event_type: "CASE_MERGED" }))).toBe("Başka bir bildirimle birleştirildi");
  });

  it("tells a comment from an internal note", () => {
    expect(managerEventLabel(event({ event_type: "COMMENT_ADDED", metadata: { is_internal: false } }))).toBe("Yorum yazıldı");
    expect(managerEventLabel(event({ event_type: "COMMENT_ADDED", metadata: { is_internal: true } }))).toBe("İç not eklendi");
  });

  it("does not hide an event it does not know", () => {
    expect(managerEventLabel(event({ event_type: "SOMETHING_NEW" }))).toBe("Bildirim güncellendi");
  });
});

describe("eventActor", () => {
  it("tells who did it: the AI step, the system or the kind of person", () => {
    expect(eventActor(event({ actor_type: "AGENT", agent_name: "routing" }))).toBe("Yapay zekâ · Yönlendirme");
    expect(eventActor(event({ actor_type: "AGENT", agent_name: null }))).toBe("Yapay zekâ");
    expect(eventActor(event({ actor_type: "SYSTEM", actor_id: null }))).toBe("Sistem");
    expect(eventActor(event({ event_type: "CASE_CREATED" }))).toBe("Bildiren");
    expect(eventActor(event({ event_type: "WORK_STARTED" }))).toBe("Personel");
    expect(eventActor(event({ event_type: "CASE_REJECTED" }))).toBe("Müdür");
    expect(eventActor(event({ event_type: "SOMETHING_NEW" }))).toBe("Kullanıcı");
  });
});

describe("awaitsManager", () => {
  it("is true only for cases that sit in the review queue", () => {
    expect(awaitsManager(caseItem({ status: "ESCALATED" }))).toBe(true);
    expect(awaitsManager(caseItem({ status: "CLASSIFIED", needs_human_review: true }))).toBe(true);
    expect(awaitsManager(caseItem({ status: "VERIFICATION", needs_human_review: true }))).toBe(true);
    expect(awaitsManager(caseItem({ status: "CLASSIFIED" }))).toBe(false);
    expect(awaitsManager(caseItem({ status: "CLOSED", needs_human_review: true }))).toBe(false);
  });
});

describe("photoList", () => {
  const file = (id: number, kind: "REPORT" | "EVIDENCE", mime = "image/jpeg"): Schemas["AttachmentRead"] => ({
    id,
    case_id: 301,
    kind,
    original_name: `dosya-${id}`,
    mime_type: mime,
    size_bytes: 1000,
    uploaded_by: 9,
    created_at: "2026-10-13T07:42:00Z",
    url: `/api/v1/attachments/${id}`,
  });

  it("numbers the reporter's photos and the staff evidence separately and skips videos", () => {
    const photos = photoList([file(1, "REPORT"), file(2, "REPORT", "video/mp4"), file(3, "EVIDENCE"), file(4, "REPORT")]);
    expect(photos.map((photo) => photo.label)).toEqual(["Bildirim fotoğrafı 1", "Kanıt fotoğrafı 1", "Bildirim fotoğrafı 2"]);
    expect(photos.map((photo) => photo.caption)).toEqual(["Bildirim fotoğrafı", "Kanıt fotoğrafı", "Bildirim fotoğrafı"]);
    expect(photos[1]?.attachment.id).toBe(3);
  });
});
