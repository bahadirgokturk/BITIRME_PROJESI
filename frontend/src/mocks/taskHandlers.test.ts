import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";

import { TASKS } from "./taskFixtures";

function post(path: string, body?: object) {
  return fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function taskIn(status: string) {
  const task = TASKS.find((item) => item.status === status);
  if (!task) {
    throw new Error(`fixture yok: ${status}`);
  }
  return task;
}

describe("mock tasks API", () => {
  it("lists my tasks, most urgent first", async () => {
    const body = await (await fetch(apiUrl("/tasks/mine"))).json();
    const dues = body.items.map((t: { due_at: string | null }) => t.due_at ?? "9999");

    expect(body.items.length).toBeGreaterThan(0);
    expect(dues).toEqual([...dues].sort());
  });

  it("walks a task: accept -> start -> complete", async () => {
    const id = taskIn("PENDING").id;

    const accepted = await (await post(`/tasks/${id}/accept`)).json();
    const started = await (await post(`/tasks/${id}/start`)).json();
    const completed = await (await post(`/tasks/${id}/complete`, { completion_note: "Tamam." })).json();

    expect([accepted.status, started.status, completed.status]).toEqual([
      "ACCEPTED",
      "IN_PROGRESS",
      "COMPLETED",
    ]);
  });

  it("refuses to start a task that was not accepted (409)", async () => {
    const second = TASKS.filter((t) => t.status === "PENDING")[1];

    const response = await post(`/tasks/${second?.id}/start`);

    expect(response.status).toBe(409);
  });

  it("returns 404 for an unknown task", async () => {
    expect((await fetch(apiUrl("/tasks/999999"))).status).toBe(404);
  });

  it("declines with a reason", async () => {
    const id = TASKS.at(-1)?.id;

    const response = await post(`/tasks/${id}/decline`, { reason: "Yetki alanım dışında." });

    expect((await response.json()).status).toBe("DECLINED");
  });

  it("filters by status", async () => {
    const body = await (await fetch(apiUrl("/tasks/mine?status=IN_PROGRESS"))).json();

    expect(body.items.every((t: { status: string }) => t.status === "IN_PROGRESS")).toBe(true);
  });
});
