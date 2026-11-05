import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/queryClient";

import { HealthStatus } from "./HealthStatus";

function renderWithQuery() {
  // Uygulamadaki varsayilan QueryClient ayarlari (yeniden deneme dahil) kullanilir
  const client = createQueryClient();
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

  it("gives backend and database their own indicator", async () => {
    mockFetch(503, { status: "degraded", database: "unavailable" });

    renderWithQuery();

    const backend = await screen.findByText("Backend çalışıyor");
    const database = screen.getByText("Veritabanına ulaşılamıyor");
    expect(backend).toHaveAttribute("data-tone", "ok");
    expect(database).toHaveAttribute("data-tone", "error");
  });

  it("shows degraded state with text, not only color", async () => {
    mockFetch(503, { status: "degraded", database: "unavailable" });

    renderWithQuery();

    expect(await screen.findByText("Veritabanına ulaşılamıyor")).toBeInTheDocument();
  });

  it("shows an error when the backend is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    renderWithQuery();

    // Ag hatasi bir kez yeniden denenir (lib/queryClient.ts); ~1 sn ek bekleme beklenir
    const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
    expect(alert).toHaveTextContent("Backend'e ulaşılamıyor");
  });
});
