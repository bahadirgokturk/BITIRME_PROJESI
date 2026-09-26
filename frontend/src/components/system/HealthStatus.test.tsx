import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HealthStatus } from "./HealthStatus";

function renderWithQuery() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HealthStatus />
    </QueryClientProvider>,
  );
}

function mockFetch(status: number, body: unknown) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HealthStatus", () => {
  it("shows healthy backend and database", async () => {
    mockFetch(200, { status: "ok", database: "ok" });

    renderWithQuery();

    expect(await screen.findByText("Backend çalışıyor")).toBeInTheDocument();
    expect(screen.getByText("Veritabanı bağlı")).toBeInTheDocument();
  });

  it("shows degraded state with text, not only color", async () => {
    mockFetch(503, { status: "degraded", database: "unavailable" });

    renderWithQuery();

    expect(await screen.findByText("Veritabanına ulaşılamıyor")).toBeInTheDocument();
  });

  it("shows an error when the backend is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    renderWithQuery();

    expect(await screen.findByRole("alert")).toHaveTextContent("Backend'e ulaşılamıyor");
  });
});
