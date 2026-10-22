import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { DepartmentPerformance } from "./DepartmentPerformance";

function renderScreen() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DepartmentPerformance />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const cards = () => within(screen.getByRole("list", { name: "Birimler" })).getAllByRole("listitem");

describe("DepartmentPerformance", () => {
  it("shows a skeleton while the units load", () => {
    renderScreen();

    expect(screen.getByRole("heading", { level: 1, name: "Birim Performansı" })).toBeInTheDocument();
    expect(screen.getByLabelText("Birimler yükleniyor")).toBeInTheDocument();
  });

  it("shows one card per unit, busiest first, each opening its detail", async () => {
    renderScreen();

    await screen.findByRole("list", { name: "Birimler" });
    expect(cards()).toHaveLength(4);
    const first = cards()[0]!;
    expect(first).toHaveTextContent("Destek Hizmetleri");
    expect(first).toHaveTextContent("Bildirim33");
    expect(first).toHaveTextContent("8 personel · kişi başı 1,5 açık görev");
    expect(within(first).getByRole("link")).toHaveAttribute("href", "/manager/departments/1");
    expect(screen.getByText("4 birim")).toBeInTheDocument();
  });

  it("narrows the cards to the ticked units", async () => {
    const user = renderScreen();
    await screen.findByRole("list", { name: "Birimler" });

    await user.click(screen.getByRole("button", { name: "Birimler: Tümü" }));
    await user.click(await screen.findByRole("checkbox", { name: "Bakım Onarım" }));

    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveTextContent("Bakım Onarım");
    expect(screen.getByRole("button", { name: "Birimler: Bakım Onarım" })).toBeInTheDocument();
    expect(screen.getByText("4 birimden 1'si gösteriliyor")).toBeInTheDocument();
  });

  it("keeps the 30 day period when a card is opened", async () => {
    const user = renderScreen();
    await screen.findByRole("list", { name: "Birimler" });

    await user.click(screen.getByRole("button", { name: "Son 30 gün" }));

    expect(within(cards()[0]!).getByRole("link")).toHaveAttribute("href", "/manager/departments/1?period=30d");
  });

  it("says so when there is no unit yet", async () => {
    server.use(http.get(apiUrl("/analytics/departments"), () => HttpResponse.json({ items: [] })));
    renderScreen();

    expect(await screen.findByText("Henüz birim yok.")).toBeInTheDocument();
  });

  it("shows the backend error and loads again on retry", async () => {
    server.use(
      http.get(
        apiUrl("/analytics/departments"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent("Birim performansı yüklenemedi.");
    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByRole("list", { name: "Birimler" })).toBeInTheDocument();
  });
});
