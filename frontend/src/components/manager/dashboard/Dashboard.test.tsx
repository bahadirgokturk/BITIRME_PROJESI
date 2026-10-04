import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { KPIS_EMPTY } from "@/mocks/analyticsFixtures";
import { server } from "@/mocks/node";

import { Dashboard } from "./Dashboard";

function renderDashboard() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Dashboard />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const card = (label: string) => screen.getByRole("group", { name: label });

describe("Dashboard", () => {
  it("shows a skeleton while the numbers load", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { level: 1, name: "Genel Bakış" })).toBeInTheDocument();
    expect(screen.getByLabelText("Genel bakış yükleniyor")).toBeInTheDocument();
  });

  it("shows the KPI cards with readable values and the change since the previous period", async () => {
    renderDashboard();

    expect(await screen.findByRole("group", { name: "Açık Bildirim" })).toHaveTextContent("42");
    expect(card("Açık Bildirim")).toHaveTextContent("▲ %12");
    expect(card("Açık Bildirim")).toHaveTextContent("önceki 7 güne göre");
    expect(card("SLA Uyumu")).toHaveTextContent("%91");
    expect(card("Ortalama Çözüm Süresi")).toHaveTextContent("5 sa 10 dk");
    expect(card("Otomasyon Oranı")).toHaveTextContent("%78");
    expect(card("Müdür İncelemesi Oranı")).toHaveTextContent("önceki dönemde veri yok");
  });

  it("answers the question in each chart title and lists the numbers as text", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "64 bildirim açıldı, 58 bildirim kapandı" })).toBeInTheDocument();
    const trend = screen.getByRole("list", { name: "Açılan ve kapanan bildirimler" });
    expect(within(trend).getAllByRole("listitem")).toHaveLength(7);
    expect(within(trend).getByText("Pzt: 8 açılan, 6 kapanan")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "En çok sorun: Temizlik (%41)" })).toBeInTheDocument();
    const categories = screen.getByRole("list", { name: "Kategoriye göre bildirim sayısı" });
    expect(within(categories).getAllByRole("listitem")[0]).toHaveTextContent("Temizlik");
    expect(within(categories).getAllByRole("listitem")[0]).toHaveTextContent("26");
  });

  it("loads the last 30 days when the period is switched", async () => {
    const user = renderDashboard();
    await screen.findByRole("group", { name: "Açık Bildirim" });

    await user.click(screen.getByRole("button", { name: "Son 30 gün" }));

    expect(await screen.findByRole("heading", { name: "251 bildirim açıldı, 236 bildirim kapandı" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Son 30 gün" })).toHaveAttribute("aria-pressed", "true");
    expect(card("SLA Uyumu")).toHaveTextContent("%89");
    expect(card("SLA Uyumu")).toHaveTextContent("önceki 30 güne göre");
    expect(within(screen.getByRole("list", { name: "Açılan ve kapanan bildirimler" })).getAllByRole("listitem")).toHaveLength(4);
  });

  it("shows the AI summary and regenerates it on request", async () => {
    let calls = 0;
    server.use(
      http.post(apiUrl("/analytics/summary"), () => {
        calls += 1;
        return HttpResponse.json({ text: `Özet ${calls}`, source: "TEMPLATE", sentences: [], kpis: {} });
      }),
    );
    const user = renderDashboard();

    expect(await screen.findByText("Özet 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yapay zekâ yönetim özeti" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yeniden oluştur" }));

    expect(await screen.findByText("Özet 2")).toBeInTheDocument();
  });

  it("keeps the dashboard when only the summary fails", async () => {
    server.use(
      http.post(apiUrl("/analytics/summary"), () =>
        HttpResponse.json({ error: { code: "INTERNAL", message: "Özet üretilemedi.", details: {} } }, { status: 500 }),
      ),
    );
    renderDashboard();

    expect(await screen.findByText("Özet üretilemedi.")).toBeInTheDocument();
    expect(card("Açık Bildirim")).toHaveTextContent("42");
  });

  it("explains an empty period instead of drawing empty charts", async () => {
    server.use(
      http.get(apiUrl("/analytics/kpis"), () => HttpResponse.json(KPIS_EMPTY)),
      http.get(apiUrl("/analytics/trend"), () => HttpResponse.json({ granularity: "day", points: [] })),
      http.get(apiUrl("/analytics/categories"), () => HttpResponse.json({ total: 0, items: [] })),
    );
    renderDashboard();

    expect(await screen.findByRole("group", { name: "Açık Bildirim" })).toHaveTextContent("0");
    expect(card("SLA Uyumu")).toHaveTextContent("–");
    expect(screen.getByText("Seçilen dönemde açılan ya da kapanan bildirim olmadı.")).toBeInTheDocument();
    expect(screen.getByText("Gösterilecek kategori yok.")).toBeInTheDocument();
    expect(screen.getByText("Özet oluşturmak için bu dönemde yeterli bildirim yok.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yeniden oluştur" })).not.toBeInTheDocument();
  });

  it("shows the backend error and loads again on retry", async () => {
    server.use(
      http.get(
        apiUrl("/analytics/kpis"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderDashboard();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Genel bakış yüklenemedi.");
    expect(alert).toHaveTextContent("Beklenmeyen bir hata oluştu.");

    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByRole("group", { name: "Açık Bildirim" })).toHaveTextContent("42");
  });
});
