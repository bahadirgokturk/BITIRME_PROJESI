import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { CASES, timelineFor } from "@/mocks/caseFixtures";
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

  it("opens the earlier steps of a long timeline on request", async () => {
    const events = Array.from({ length: 9 }, (_, index) => ({
      ...timelineFor(CASES[0]!)[0]!,
      id: 9000 + index,
      event_type: index === 0 ? "CASE_CREATED" : "ROUTED",
    }));
    events[8] = { ...events[8]!, event_type: "CASE_CLOSED" };
    server.use(http.get(apiUrl("/cases/:id/events"), () => HttpResponse.json(events)));
    renderDetail("101");
    const user = userEvent.setup();

    const timeline = await screen.findByRole("list", { name: "Zaman çizelgesi" });
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(3);
    expect(within(timeline).queryByText("Bildiriminiz alındı")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "6 önceki adımı göster" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(within(timeline).getAllByRole("listitem")).toHaveLength(9);
    expect(within(timeline).getByText("Bildiriminiz alındı")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Önceki adımları gizle" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Önceki adımları gizle" }));

    expect(within(timeline).getAllByRole("listitem")).toHaveLength(3);
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

  it("shows the question asked to the reporter and the plain timeline steps", async () => {
    renderDetail("104");

    expect(await screen.findByText(/Kokuyu en çok amfinin hangi tarafında/)).toBeInTheDocument();
    const timeline = await screen.findByRole("list", { name: "Zaman çizelgesi" });
    expect(within(timeline).getByText("Sizden ek bilgi istendi")).toBeInTheDocument();
    // Bilinmeyen olay kalmadi: mock zaman cizelgesi backend'in reporter'a gosterdigi olaylarla ayni
    expect(within(timeline).queryByText("Bildiriminiz güncellendi")).not.toBeInTheDocument();
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
