import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiGet } from "./client";

function mockFetch(status: number, body: unknown) {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiGet", () => {
  it("prefixes the API base URL and returns parsed JSON", async () => {
    const fetchSpy = mockFetch(200, { status: "ok" });

    const data = await apiGet<{ status: string }>("/health");

    expect(data).toEqual({ status: "ok" });
    const request = fetchSpy.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://api.test/api/v1/health");
  });

  it("throws ApiError with the backend error envelope", async () => {
    mockFetch(404, { error: { code: "NOT_FOUND", message: "Kayıt bulunamadı.", details: {} } });

    const error = await apiGet("/cases/1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "NOT_FOUND", message: "Kayıt bulunamadı." });
  });

  it("keeps non-envelope error bodies for the caller", async () => {
    mockFetch(503, { status: "degraded", database: "unavailable" });

    const error = await apiGet("/health").catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 503, code: "HTTP_503" });
    expect((error as ApiError).body).toEqual({ status: "degraded", database: "unavailable" });
  });
});
