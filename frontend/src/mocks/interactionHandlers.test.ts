import { afterEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";

import { USERS } from "./fixtures";
import { resetComments } from "./interactionHandlers";
import { signInAs } from "./session";

function post(path: string, body: object) {
  return fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Sahte oturum ve yorumlar modul icinde tutulur; her test bildiren olarak ve temiz listeyle baslar
afterEach(() => {
  signInAs(null);
  resetComments();
});

describe("mock comments / feedback / reopen API", () => {
  it("adds a public comment and lists it with the author name", async () => {
    const response = await post("/cases/101/comments", {
      body: "Hâlâ sabun yok.",
    });
    const comments = await (await fetch(apiUrl("/cases/101/comments"))).json();

    expect(response.status).toBe(201);
    expect(comments.at(-1)).toMatchObject({
      body: "Hâlâ sabun yok.",
      is_internal: false,
    });
    expect(comments.at(-1).author_name).toBeTruthy();
  });

  it("lets staff and managers write internal notes that the reporter never sees", async () => {
    signInAs(USERS.STAFF);
    const note = await post("/cases/101/comments", { body: "Depoda sabun yok.", is_internal: true });
    const forStaff = await (await fetch(apiUrl("/cases/101/comments"))).json();
    signInAs(USERS.REPORTER);
    const forReporter = await (await fetch(apiUrl("/cases/101/comments"))).json();

    expect(note.status).toBe(201);
    expect(await note.json()).toMatchObject({ is_internal: true, author_role: "STAFF", author_name: USERS.STAFF.full_name });
    expect(forStaff.map((c: { body: string }) => c.body)).toContain("Depoda sabun yok.");
    expect(forReporter.map((c: { body: string }) => c.body)).not.toContain("Depoda sabun yok.");
  });

  it("refuses an internal note from a reporter and any comment from an admin (403)", async () => {
    expect((await post("/cases/101/comments", { body: "Gizli", is_internal: true })).status).toBe(403);
    signInAs(USERS.ADMIN);
    expect((await post("/cases/101/comments", { body: "Merhaba" })).status).toBe(403);
  });

  it("rejects an empty comment (422)", async () => {
    expect((await post("/cases/101/comments", { body: "  " })).status).toBe(
      422,
    );
  });

  it("rates a closed case once", async () => {
    const first = await post("/cases/103/feedback", { rating: 5 });
    const second = await post("/cases/103/feedback", { rating: 4 });

    expect(first.status).toBe(200);
    expect((await first.json()).satisfaction_rating).toBe(5);
    expect(second.status).toBe(409);
  });

  it("does not rate an open case (409)", async () => {
    expect((await post("/cases/101/feedback", { rating: 5 })).status).toBe(409);
  });

  it("reopens a closed case", async () => {
    const response = await post("/cases/103/reopen", {
      reason: "Çöp yine taştı.",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "REOPENED",
      reopened_count: 1,
    });
  });

  it("answers the question and sends the case back to analysis", async () => {
    const response = await post("/cases/104/info", { body: "Kapıya yakın tarafta." });
    const comments = await (await fetch(apiUrl("/cases/104/comments"))).json();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ANALYZING", info_request: null });
    expect(comments.at(-1)).toMatchObject({ body: "Kapıya yakın tarafta." });
  });

  it("does not accept an answer when nothing was asked (409)", async () => {
    expect((await post("/cases/101/info", { body: "Ek bilgi" })).status).toBe(409);
  });
});
