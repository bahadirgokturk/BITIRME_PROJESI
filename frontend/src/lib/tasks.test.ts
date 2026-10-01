import { describe, expect, it } from "vitest";

import { TASKS } from "@/mocks/taskFixtures";

import {
  addEvidence,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_COUNT,
  evidenceProblem,
  isValidTaskNote,
  slaView,
  TASK_NOTE_MAX_LENGTH,
  taskActions,
} from "./tasks";

const NOW = new Date("2026-09-27T12:00:00Z");
const task = { ...TASKS[0]!, status: "PENDING" as const, due_at: "2026-09-27T12:42:00Z", sla_status: "AT_RISK" as const };

describe("slaView", () => {
  it("tells how much time is left in minutes", () => {
    expect(slaView(task, NOW)).toEqual({ status: "AT_RISK", label: "42 dk kaldı" });
  });

  it("uses hours and minutes for longer waits", () => {
    const later = { ...task, due_at: "2026-09-27T15:12:00Z", sla_status: "ON_TRACK" as const };

    expect(slaView(later, NOW)).toEqual({ status: "ON_TRACK", label: "3 sa 12 dk kaldı" });
    expect(slaView({ ...later, due_at: "2026-09-27T15:00:00Z" }, NOW)?.label).toBe("3 sa kaldı");
  });

  it("uses days when the deadline is far", () => {
    expect(slaView({ ...task, due_at: "2026-09-29T13:00:00Z" }, NOW)?.label).toBe("2 gün kaldı");
  });

  it("tells how late an overdue task is", () => {
    const late = { ...task, due_at: "2026-09-27T11:35:00Z", sla_status: "BREACHED" as const };

    expect(slaView(late, NOW)).toEqual({ status: "BREACHED", label: "25 dk gecikti" });
  });

  it("shows nothing without a deadline or for a finished task", () => {
    expect(slaView({ ...task, due_at: null, sla_status: null }, NOW)).toBeNull();
    expect(slaView({ ...task, status: "COMPLETED" }, NOW)).toBeNull();
    expect(slaView({ ...task, status: "DECLINED" }, NOW)).toBeNull();
  });
});

describe("taskActions", () => {
  it("offers one main action per status", () => {
    expect(taskActions("PENDING")).toEqual({ primary: "accept", canDecline: true });
    expect(taskActions("ACCEPTED")).toEqual({ primary: "start", canDecline: true });
    expect(taskActions("IN_PROGRESS")).toEqual({ primary: "complete", canDecline: false });
  });

  it("offers nothing for a finished task", () => {
    expect(taskActions("COMPLETED")).toEqual({ primary: null, canDecline: false });
    expect(taskActions("DECLINED")).toEqual({ primary: null, canDecline: false });
    expect(taskActions("CANCELLED")).toEqual({ primary: null, canDecline: false });
  });
});

describe("evidenceProblem", () => {
  const photo = (type: string, size = 10) => ({ type, size });

  it("accepts the photo types the backend accepts", () => {
    expect(evidenceProblem(photo("image/jpeg"))).toBeNull();
    expect(evidenceProblem(photo("image/png"))).toBeNull();
    expect(evidenceProblem(photo("image/webp", EVIDENCE_MAX_BYTES))).toBeNull();
  });

  it("explains why a file cannot be used", () => {
    expect(evidenceProblem(photo("application/pdf"))).toMatch(/JPG, PNG ya da WEBP/);
    expect(evidenceProblem(photo("image/jpeg", EVIDENCE_MAX_BYTES + 1))).toMatch(/en fazla 5 MB/);
  });
});

describe("addEvidence", () => {
  const file = (name: string, type = "image/jpeg") => new File(["x"], name, { type });

  it("adds the picked photos to the ones already chosen", () => {
    const first = file("a.jpg");
    const result = addEvidence([first], [file("b.jpg"), file("c.png", "image/png")]);

    expect(result.photos.map((photo) => photo.name)).toEqual(["a.jpg", "b.jpg", "c.png"]);
    expect(result.problem).toBeNull();
  });

  it("skips a file that cannot be used and says why", () => {
    const result = addEvidence([], [file("not.pdf", "application/pdf"), file("ok.jpg")]);

    expect(result.photos.map((photo) => photo.name)).toEqual(["ok.jpg"]);
    expect(result.problem).toMatch(/JPG, PNG ya da WEBP/);
  });

  it("stops at the backend limit per case", () => {
    const many = Array.from({ length: EVIDENCE_MAX_COUNT + 2 }, (_, index) => file(`${index}.jpg`));

    const result = addEvidence([], many);

    expect(result.photos).toHaveLength(EVIDENCE_MAX_COUNT);
    expect(result.problem).toBe(`En fazla ${EVIDENCE_MAX_COUNT} fotoğraf eklenebilir.`);
  });
});

describe("isValidTaskNote", () => {
  it("requires text within the backend limit", () => {
    expect(isValidTaskNote("   ")).toBe(false);
    expect(isValidTaskNote("Bu iş teknik ekibin.")).toBe(true);
    expect(isValidTaskNote("a".repeat(TASK_NOTE_MAX_LENGTH + 1))).toBe(false);
  });
});
