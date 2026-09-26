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

  it("serves admin lists in the Page format", async () => {
    const body = await (await fetch(apiUrl("/admin/departments"))).json();

    expect(body).toMatchObject({ page: 1, total: body.items.length });
    expect(body.items.length).toBeGreaterThan(0);
  });
});
