import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";

import { MOCK_PASSWORD, USERS } from "./fixtures";

async function login(email: string, password: string) {
  return fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

describe("mock API", () => {
  it("logs in a fixture user with the shared demo password", async () => {
    const response = await login(USERS.STAFF.email, MOCK_PASSWORD);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ token_type: "bearer" });
  });

  it("rejects a wrong password with the backend error envelope", async () => {
    const response = await login(USERS.STAFF.email, "yanlis");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("answers /auth/me with whoever signed in last, so each role can be tried without a restart", async () => {
    await login(USERS.ADMIN.email, MOCK_PASSWORD);
    expect(await (await fetch(apiUrl("/auth/me"))).json()).toMatchObject({ role: "ADMIN" });

    await login(USERS.MANAGER.email, MOCK_PASSWORD);
    expect(await (await fetch(apiUrl("/auth/me"))).json()).toMatchObject({ email: USERS.MANAGER.email });
  });

  it("goes back to the configured role after signing out", async () => {
    await login(USERS.ADMIN.email, MOCK_PASSWORD);
    await fetch(apiUrl("/auth/logout"), { method: "POST" });

    expect(await (await fetch(apiUrl("/auth/me"))).json()).toMatchObject({ role: "REPORTER" });
  });

  it("keeps the signed-in user after a failed attempt with a wrong password", async () => {
    await login(USERS.STAFF.email, MOCK_PASSWORD);
    await login(USERS.ADMIN.email, "yanlis");

    expect(await (await fetch(apiUrl("/auth/me"))).json()).toMatchObject({ role: "STAFF" });
    await fetch(apiUrl("/auth/logout"), { method: "POST" });
  });

  it("serves admin lists in the Page format", async () => {
    const body = await (await fetch(apiUrl("/admin/departments"))).json();

    expect(body).toMatchObject({ page: 1, total: body.items.length });
    expect(body.items.length).toBeGreaterThan(0);
  });
});
