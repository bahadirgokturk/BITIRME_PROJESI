import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { RECURRING } from "@/mocks/reportFixtures";
import { server } from "@/mocks/node";

import { Reports } from "./Reports";

function renderReports() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Reports />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const heading = (name: string) => screen.findByRole("heading", { name });
const firstItem = (listName: string) => within(screen.getByRole("list", { name: listName })).getAllByRole("listitem")[0];

describe("Reports", () => {
  it("shows a skeleton while the reports load", () => {
    renderReports();

    expect(screen.getByRole("heading", { level: 1, name: "Raporlar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Raporlar yükleniyor")).toBeInTheDocument();
  });

  it("answers where the problems are and whether they are solved in time", async () => {
    renderReports();

    expect(await heading("En yoğun bina: B Blok (21 bildirim)")).toBeInTheDocument();
    const buildings = screen.getByRole("list", { name: "Binaya göre bildirim sayısı" });
    expect(within(buildings).getAllByRole("listitem")).toHaveLength(6);
    expect(firstItem("Binaya göre bildirim sayısı")).toHaveTextContent("B Blok");
    expect(firstItem("Binaya göre bildirim sayısı")).toHaveTextContent("En çok: Temizlik");

    expect(screen.getByRole("heading", { name: "Zamanında çözülen: %91" })).toBeInTheDocument();
    expect(firstItem("Hedef süreye (SLA) uyum, önceliğe göre")).toHaveTextContent("Kritik");
    expect(firstItem("Hedef süreye (SLA) uyum, önceliğe göre")).toHaveTextContent("5 işten 4 tanesi zamanında");
    expect(screen.getByText("58 bildirimden 53 tanesi zamanında çözüldü, 5 tanesi gecikti.")).toBeInTheDocument();
  });

  it("shows how long solving takes and what is still waiting", async () => {
    renderReports();

    expect(await heading("En uzun süren: Teknik (tipik 7 sa)")).toBeInTheDocument();
    const times = screen.getByRole("table", { name: "Kategoriye göre çözüm süresi" });
    const cleaning = within(times).getByRole("row", { name: /Temizlik/ });
    expect(cleaning).toHaveTextContent("2 sa 40 dk");
    expect(cleaning).toHaveTextContent("1 sa 50 dk");
    expect(cleaning).toHaveTextContent("6 sa");
    expect(within(times).getByRole("row", { name: /Diğer/ })).toHaveTextContent("–");

    expect(screen.getByRole("heading", { name: "42 bildirim bekliyor" })).toBeInTheDocument();
    expect(firstItem("Açık bildirimler ne kadar süredir bekliyor")).toHaveTextContent("0–2 sa");
    expect(screen.getByText("4 bildirim 24 saatten uzun süredir açık.")).toBeInTheDocument();
  });

  it("compares the units", async () => {
    renderReports();

    expect(await heading("En yoğun birim: Bakım Onarım (kişi başı 4,5 açık görev)")).toBeInTheDocument();
    const units = screen.getByRole("table", { name: "Birimlere göre performans ve iş yükü" });
    const maintenance = within(units).getByRole("row", { name: /Bakım Onarım/ });
    expect(maintenance).toHaveTextContent("9 sa 20 dk");
    expect(maintenance).toHaveTextContent("%78");
    expect(maintenance).toHaveTextContent("4,5");
  });

  it("lists the recurring problems with a suggestion and marks the slowest step", async () => {
    renderReports();

    expect(await heading("3 sorun tekrar ediyor")).toBeInTheDocument();
    const soap = firstItem("Son 30 günde aynı yerde 5 ve daha fazla kez bildirilenler");
    expect(soap).toHaveTextContent("Sabun bitti");
    expect(soap).toHaveTextContent("B Blok 2. Kat Erkek WC");
    expect(soap).not.toHaveTextContent("KMP/");
    expect(soap).toHaveTextContent("17 kez");
    expect(soap).toHaveTextContent("▲ Artıyor");
    expect(soap).toHaveTextContent("Kalıcı çözüm (dispenser kapasitesi / periyodik kontrol) değerlendirilebilir.");

    expect(screen.getByRole("heading", { name: "En yavaş adım: Atamadan kabule" })).toBeInTheDocument();
    const steps = within(screen.getByRole("list", { name: "Bir bildirimin adımları arasında geçen tipik süre" }));
    expect(steps.getAllByRole("listitem")).toHaveLength(5);
    expect(steps.getAllByRole("listitem")[1]).toHaveTextContent("Atamadan kabuleEn yavaş42 dk");
    expect(steps.getAllByText("En yavaş")).toHaveLength(1);
  });

  it("shows the five most repeated problems first and the rest on request", async () => {
    const problem = RECURRING.items[0]!;
    const items = Array.from({ length: 7 }, (_, index) => ({
      ...problem,
      location: { ...problem.location, id: 100 + index, name: `Derslik ${index + 1}` },
    }));
    server.use(http.get(apiUrl("/analytics/recurring"), () => HttpResponse.json({ ...RECURRING, items })));
    const user = renderReports();

    expect(await heading("7 sorun tekrar ediyor")).toBeInTheDocument();
    const list = within(screen.getByRole("list", { name: "Son 30 günde aynı yerde 5 ve daha fazla kez bildirilenler" }));
    expect(list.getAllByRole("listitem")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "7 sorunun hepsini göster" }));

    expect(list.getAllByRole("listitem")).toHaveLength(7);
    expect(list.getByText("Derslik 7")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Daha az göster" }));

    expect(list.getAllByRole("listitem")).toHaveLength(5);
  });

  it("loads the last 30 days when the period is switched", async () => {
    const user = renderReports();
    await heading("En yoğun bina: B Blok (21 bildirim)");

    await user.click(screen.getByRole("button", { name: "Son 30 gün" }));

    expect(await heading("En yoğun bina: B Blok (82 bildirim)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Zamanında çözülen: %89" })).toBeInTheDocument();
  });

  it("explains each empty report instead of drawing empty charts", async () => {
    server.use(
      http.get(apiUrl("/analytics/locations"), () => HttpResponse.json({ level: "building", items: [] })),
      http.get(apiUrl("/analytics/sla"), () =>
        HttpResponse.json({ with_sla: 0, met: 0, breached: 0, compliance_pct: null, by_priority: [] }),
      ),
      http.get(apiUrl("/analytics/resolution-times"), () => HttpResponse.json({ items: [] })),
      http.get(apiUrl("/analytics/aging"), () => HttpResponse.json({ total_open: 0, buckets: [] })),
      http.get(apiUrl("/analytics/departments"), () => HttpResponse.json({ items: [] })),
      http.get(apiUrl("/analytics/recurring"), () => HttpResponse.json({ threshold: 5, window_days: 30, items: [] })),
      http.get(apiUrl("/analytics/process"), () => HttpResponse.json({ steps: [], bottleneck: null })),
    );
    renderReports();

    expect(await heading("Bina yoğunluğu")).toBeInTheDocument();
    expect(screen.getByText("Bu dönemde bildirim yok.")).toBeInTheDocument();
    expect(screen.getByText("Bu dönemde hedef süresi olan bildirim yok.")).toBeInTheDocument();
    expect(screen.getByText("Bu dönemde çözülen bildirim yok.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bekleyen bildirim yok" })).toBeInTheDocument();
    expect(screen.getByText("Şu anda açık bildirim yok.")).toBeInTheDocument();
    expect(screen.getByText("Bu dönemde birimlere atanan bildirim yok.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tekrar eden sorun yok" })).toBeInTheDocument();
    expect(screen.getByText("Aynı yerde tekrar tekrar bildirilen bir sorun görülmedi.")).toBeInTheDocument();
    expect(screen.getByText("Bu dönemde ölçülecek adım yok.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the backend error and loads again on retry", async () => {
    server.use(
      http.get(
        apiUrl("/analytics/departments"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderReports();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Raporlar yüklenemedi.");
    expect(alert).toHaveTextContent("Beklenmeyen bir hata oluştu.");

    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await heading("En yoğun bina: B Blok (21 bildirim)")).toBeInTheDocument();
  });
});
