import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { MyCasesList } from "./MyCasesList";

function renderList() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MyCasesList />
    </QueryClientProvider>,
  );
}

function failOnce(status: number, message: string) {
  server.use(
    http.get(
      apiUrl("/cases/mine"),
      () => HttpResponse.json({ error: { code: "INTERNAL", message, details: {} } }, { status }),
      { once: true },
    ),
  );
}

describe("MyCasesList", () => {
  it("shows a skeleton while the cases load", () => {
    renderList();

    expect(screen.getByLabelText("Bildirimler yükleniyor")).toBeInTheDocument();
  });

  it("lists the reporter's cases and links each one to its detail", async () => {
    renderList();

    const link = await screen.findByRole("link", { name: /Tuvalette sabun bitmiş/ });
    expect(link).toHaveAttribute("href", "/cases/101");
    expect(within(link).getByText("B Blok 2. Kat Erkek WC")).toBeInTheDocument();
    expect(within(link).getByText(/CASE-000101/)).toBeInTheDocument();
  });

  it("marks the current step with text, not only color", async () => {
    renderList();

    const link = await screen.findByRole("link", { name: /Amfide projeksiyon çalışmıyor/ });
    const current = within(link).getByText("Çalışılıyor");
    expect(current.closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("explains a case waiting for more information instead of a progress bar", async () => {
    renderList();

    const link = await screen.findByRole("link", { name: /Amfide garip bir koku var/ });
    expect(within(link).getByText(/Ek bilgi gerekiyor/)).toBeInTheDocument();
    expect(within(link).queryByRole("list", { name: "İlerleme" })).not.toBeInTheDocument();
  });

  it("offers the next step when the reporter has no cases", async () => {
    server.use(
      http.get(apiUrl("/cases/mine"), () => HttpResponse.json({ items: [], total: 0, page: 1 })),
    );

    renderList();

    expect(await screen.findByText("Henüz bildiriminiz yok.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bildirim yap" })).toHaveAttribute("href", "/report");
  });

  it("shows the backend error and loads again on retry", async () => {
    failOnce(500, "Beklenmeyen bir hata oluştu.");

    renderList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bildirimleriniz yüklenemedi.");
    expect(alert).toHaveTextContent("Beklenmeyen bir hata oluştu.");

    await userEvent.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByRole("link", { name: /Tuvalette sabun bitmiş/ })).toBeInTheDocument();
  });
});
