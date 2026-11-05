import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { apiGet, apiUrl, resetTransport, setTransport } from "./client";
import { mockTransport } from "@/mocks/transport";

afterEach(() => {
  resetTransport();
});

describe("mock transport", () => {
  it("answers mocked endpoints in-process, without a service worker", async () => {
    setTransport(mockTransport([http.get(apiUrl("/demo"), () => HttpResponse.json({ from: "mock" }))]));

    expect(await apiGet("/demo")).toEqual({ from: "mock" });
  });

  it("sends endpoints without a mock handler to the real backend", async () => {
    setTransport(mockTransport([]));

    // Test ortaminda "gercek backend" = vitest.setup.ts'teki MSW node sunucusu
    expect(await apiGet("/auth/me")).toMatchObject({ role: "REPORTER" });
  });
});
