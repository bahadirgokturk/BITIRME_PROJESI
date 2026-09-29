import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";

import { CASES } from "./caseFixtures";

function postCase(body: object) {
  return fetch(apiUrl("/cases"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("mock cases API", () => {
  it("lists report-form locations without admin-only fields", async () => {
    const body = await (await fetch(apiUrl("/locations"))).json();

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).not.toHaveProperty("importance_weight");
  });

  it("creates a case that starts in ANALYZING and shows up in my cases", async () => {
    const response = await postCase({
      description: "Zemin kat tuvaletinde sabun bitmiş.",
      location_id: 4,
    });
    const created = await response.json();
    const mine = await (await fetch(apiUrl("/cases/mine"))).json();

    expect(response.status).toBe(201);
    expect(created.status).toBe("ANALYZING");
    expect(created.case_number).toMatch(/^CASE-\d{6}$/);
    expect(mine.items.map((c: { id: number }) => c.id)).toContain(created.id);
  });

  it("rejects a too-short description like the backend (422)", async () => {
    const response = await postCase({ description: "kısa", location_id: 4 });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("returns 404 for an unknown case", async () => {
    const response = await fetch(apiUrl("/cases/999999"));

    expect(response.status).toBe(404);
  });

  it("filters the case list by status", async () => {
    const body = await (await fetch(apiUrl("/cases?status=CLOSED"))).json();

    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.every((c: { status: string }) => c.status === "CLOSED"),
    ).toBe(true);
  });

  it("serves a timeline that starts with CASE_CREATED", async () => {
    const events = await (
      await fetch(apiUrl(`/cases/${CASES[0]?.id}/events`))
    ).json();

    expect(events[0].event_type).toBe("CASE_CREATED");
  });
});

describe("mock attachments API", () => {
  function upload(caseId: number, file: File) {
    const form = new FormData();
    form.append("file", file);
    return fetch(apiUrl(`/cases/${caseId}/attachments`), {
      method: "POST",
      body: form,
    });
  }

  it("accepts a photo and lists it under the case", async () => {
    const photo = new File([new Uint8Array([137, 80, 78, 71])], "sabun.png", {
      type: "image/png",
    });

    const response = await upload(101, photo);
    const created = await response.json();
    const listing = await (
      await fetch(apiUrl("/cases/101/attachments"))
    ).json();

    expect(response.status).toBe(201);
    // Dosya adi burada kontrol edilmez: jsdom File nesnesi Node fetch'inde adini kaybeder ("blob");
    // ad temizligi backend testinde (test_file_name_is_sanitized)
    expect(created).toMatchObject({ kind: "REPORT", mime_type: "image/png" });
    expect(listing.map((item: { id: number }) => item.id)).toContain(
      created.id,
    );
  });

  it("rejects a non-image like the backend (415)", async () => {
    const pdf = new File(["%PDF"], "rapor.pdf", { type: "application/pdf" });

    const response = await upload(101, pdf);

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
  });

  it("serves the uploaded photo as an image", async () => {
    const photo = new File([new Uint8Array([1])], "a.png", {
      type: "image/png",
    });
    const created = await (await upload(101, photo)).json();

    const download = await fetch(apiUrl(created.url.replace("/api/v1", "")));

    expect(download.headers.get("content-type")).toBe("image/png");
  });
});

describe("mock attachments API (video)", () => {
  it("accepts a short phone video", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([0])], "kacak.mp4", { type: "video/mp4" }),
    );

    const response = await fetch(apiUrl("/cases/102/attachments"), {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ mime_type: "video/mp4" });
  });
});
