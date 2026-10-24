import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { KPIS_WEEK } from "@/mocks/analyticsFixtures";
import { server } from "@/mocks/node";

import { DepartmentDetail } from "./DepartmentDetail";

function renderDetail(id: string) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DepartmentDetail departmentId={id} initialPeriod="7d" />
    </QueryClientProvider>,
  );
}

describe("DepartmentDetail", () => {
  it("shows the unit's summary, indicators, charts and recurring problems", async () => {
    renderDetail("2");

    expect(await screen.findByRole("heading", { level: 1, name: "Bakım Onarım" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Birim Performansı" })).toHaveAttribute("href", "/manager/departments");
    expect(screen.getByRole("group", { name: "Birim özeti" })).toHaveTextContent("4 personel · kişi başı 4,5 açık görev");
    expect(await screen.findByRole("list", { name: "Temel göstergeler" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /sorun tekrar ediyor/ })).toBeInTheDocument();
  });

  // Gosterge, grafik ve tekrarlayan sorunlar yalniz bu birim icin istenir
  it("asks the backend for this unit only", async () => {
    const asked: string[] = [];
    server.use(
      http.get(apiUrl("/analytics/kpis"), ({ request }) => {
        asked.push(new URL(request.url).searchParams.get("department_id") ?? "yok");
        return HttpResponse.json(KPIS_WEEK);
      }),
    );
    renderDetail("2");

    await waitFor(() => expect(asked).toContain("2"));
  });

  it("does not reveal a unit that is not in the list", async () => {
    renderDetail("999");

    expect(await screen.findByText("Birim bulunamadı")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Birim Performansı'na dön" })).toHaveAttribute("href", "/manager/departments");
  });
});
