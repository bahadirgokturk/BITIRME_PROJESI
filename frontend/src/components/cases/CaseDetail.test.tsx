import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { CaseDetail } from "./CaseDetail";

function renderDetail(caseId: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CaseDetail caseId={caseId} />
    </QueryClientProvider>,
  );
}

function fail(path: string) {
  server.use(
    http.get(apiUrl(path), () =>
      HttpResponse.json(
        { error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } },
        { status: 500 },
      ),
    ),
  );
}

describe("CaseDetail", () => {
  it("shows a skeleton while the case loads", () => {
    renderDetail("101");

    expect(screen.getByLabelText("Bildirim yükleniyor")).toBeInTheDocument();
  });

  it("shows the case details, progress and timeline", async () => {
    renderDetail("101");

    expect(await screen.findByRole("heading", { name: "Tuvalette sabun bitmiş" })).toBeInTheDocument();
    expect(screen.getByText("CASE-000101")).toBeInTheDocument();
    expect(screen.getByText("B Blok 2. kat erkek tuvaletinde sabunluklar boş.")).toBeInTheDocument();
    expect(screen.getByText("Destek Hizmetleri Şube Müdürlüğü")).toBeInTheDocument();
    expect(screen.getByText("Yönlendirildi").closest("li")).toHaveAttribute("aria-current", "step");

    const timeline = await screen.findByRole("list", { name: "Zaman çizelgesi" });
    expect(within(timeline).getByText("Bildiriminiz alındı")).toBeInTheDocument();
  });

  it("links back to the reporter's cases", async () => {
    renderDetail("101");

    await screen.findByRole("heading", { name: "Tuvalette sabun bitmiş" });
    expect(screen.getByRole("link", { name: /Bildirimlerim/ })).toHaveAttribute("href", "/my-cases");
  });

  it("says the department is not decided yet and explains the waiting state", async () => {
    renderDetail("104");

    await screen.findByRole("heading", { name: "Amfide garip bir koku var" });
    expect(screen.getByText("Henüz belirlenmedi")).toBeInTheDocument();
    expect(screen.getByText(/Ek bilgi gerekiyor/)).toBeInTheDocument();
  });

  it("shows the same not-found screen for a missing or foreign case", async () => {
    renderDetail("999");

    expect(await screen.findByText("Kayıt bulunamadı")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bildirimlerime dön" })).toHaveAttribute(
      "href",
      "/my-cases",
    );
  });

  it("shows an error with retry when the case cannot be loaded", async () => {
    fail("/cases/101");

    renderDetail("101");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bildirim yüklenemedi.");
    expect(within(alert).getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });

  it("keeps the details when only the timeline fails", async () => {
    fail("/cases/101/events");

    renderDetail("101");

    expect(await screen.findByRole("heading", { name: "Tuvalette sabun bitmiş" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Zaman çizelgesi yüklenemedi.");
  });
});
