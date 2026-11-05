import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";

import {
  pendingMeta,
  pendingSentText,
  pendingStatus,
  pendingTitle,
  queuedAfter,
  UPLOAD_LOST_MESSAGE,
  type PendingReport,
} from "./pendingReports";

const report: PendingReport = {
  id: "p1",
  userId: 7,
  description: "Amfide projeksiyon görüntü vermiyor, ders başlamak üzere.",
  locationId: 4,
  files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })],
  savedAt: "2026-10-29T11:05:00Z",
  error: null,
};

describe("pendingTitle", () => {
  it("counts the reports that wait to be sent", () => {
    expect(pendingTitle(2)).toBe("Gönderilmeyi bekleyen 2 bildirim");
  });
});

describe("pendingMeta", () => {
  it("names the place, the number of files and when it was saved", () => {
    expect(pendingMeta(report, "A-101 Amfi")).toMatch(/^A-101 Amfi · 1 dosya · /);
  });

  it("leaves the files out when there are none", () => {
    expect(pendingMeta({ ...report, files: [] }, "A-101 Amfi")).not.toMatch(/dosya/);
  });
});

describe("pendingStatus", () => {
  it("says it will go when the connection is back", () => {
    expect(pendingStatus(report)).toEqual({ text: "İnternet gelince gönderilecek.", failed: false });
  });

  it("passes on why the backend refused it", () => {
    expect(pendingStatus({ ...report, error: "Konum artık kullanılmıyor." })).toEqual({
      text: "Gönderilemedi: Konum artık kullanılmıyor.",
      failed: true,
    });
  });
});

describe("pendingSentText", () => {
  it("names the case number the queued report got", () => {
    expect(pendingSentText("CASE-000620")).toBe("Bekleyen bildirimin gönderildi: CASE-000620");
  });
});

describe("queuedAfter", () => {
  // Ag hatasi (fetch TypeError): istek sunucuya ulasmadi, bildirim siraya alinir
  it("queues a report after a network error", () => {
    expect(queuedAfter(new TypeError("Failed to fetch"))).toBe(true);
  });

  // Backend cevap verdi (422, 403...): ayni istek tekrar denense de reddedilir, form hatayi gosterir
  it("does not queue a report the backend answered with an error", () => {
    expect(queuedAfter(new ApiError(422, "VALIDATION", "Konum geçersiz.", {}))).toBe(false);
  });

  it("explains a photo lost to a dropped connection after the report was saved", () => {
    expect(UPLOAD_LOST_MESSAGE).toBe("Bağlantı koptuğu için yüklenemedi.");
  });
});
