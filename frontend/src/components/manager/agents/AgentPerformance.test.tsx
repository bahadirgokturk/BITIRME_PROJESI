import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { AGENT_METRICS_EMPTY } from "@/mocks/reportFixtures";
import { server } from "@/mocks/node";

import { AgentPerformance } from "./AgentPerformance";

function renderScreen() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AgentPerformance />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const card = (label: string) => screen.getByRole("group", { name: label });

describe("AgentPerformance", () => {
  it("shows a skeleton while the numbers load", () => {
    renderScreen();

    expect(screen.getByRole("heading", { level: 1, name: "Yapay Zekâ Performansı" })).toBeInTheDocument();
    expect(screen.getByLabelText("Yapay zekâ performansı yükleniyor")).toBeInTheDocument();
  });

  it("shows the four rates with a plain explanation", async () => {
    renderScreen();

    expect(await screen.findByRole("group", { name: "Otomasyon Oranı" })).toHaveTextContent("%78");
    expect(card("Otomasyon Oranı")).toHaveTextContent("Kimse dokunmadan doğru personele atanan bildirimler");
    expect(card("Müdür İncelemesi Oranı")).toHaveTextContent("%14");
    expect(card("Doğru Tür Tahmini")).toHaveTextContent("%92");
    expect(card("Doğru Tekrar Tespiti")).toHaveTextContent("%88");
  });

  it("lists every step with its decisions, confidence and corrections", async () => {
    renderScreen();

    expect(await screen.findByRole("heading", { name: "En çok düzeltilen adım: Birime yönlendirme (%9)" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Yapay zekâ adımlarına göre karar sayısı, güven ve düzeltilme" });
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    const routing = within(table).getByRole("row", { name: /Birime yönlendirme/ });
    expect(routing).toHaveTextContent("58");
    expect(routing).toHaveTextContent("%86");
    expect(routing).toHaveTextContent("%9");
  });

  it("loads the last 30 days when the period is switched", async () => {
    const user = renderScreen();
    await screen.findByRole("group", { name: "Otomasyon Oranı" });

    await user.click(screen.getByRole("button", { name: "Son 30 gün" }));

    expect(await screen.findByRole("heading", { name: "En çok düzeltilen adım: Birime yönlendirme (%11)" })).toBeInTheDocument();
    expect(card("Otomasyon Oranı")).toHaveTextContent("%76");
  });

  it("explains a period without decisions", async () => {
    server.use(http.get(apiUrl("/agents/metrics"), () => HttpResponse.json(AGENT_METRICS_EMPTY)));
    renderScreen();

    expect(await screen.findByRole("group", { name: "Otomasyon Oranı" })).toHaveTextContent("–");
    expect(screen.getByRole("heading", { name: "Yapay zekâ adımları" })).toBeInTheDocument();
    expect(screen.getByText("Bu dönemde yapay zekâ kararı yok.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the backend error and loads again on retry", async () => {
    server.use(
      http.get(
        apiUrl("/agents/metrics"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Yapay zekâ performansı yüklenemedi.");
    expect(alert).toHaveTextContent("Beklenmeyen bir hata oluştu.");

    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByRole("group", { name: "Otomasyon Oranı" })).toHaveTextContent("%78");
  });
});
