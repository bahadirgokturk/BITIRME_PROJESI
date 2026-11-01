import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import type { AuditTarget } from "@/lib/auditLogs";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { AuditLogsScreen } from "./AuditLogsScreen";

const PAGE_SIZE = 50;
const MANY = 120;

function renderScreen(target: AuditTarget | null = null) {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AuditLogsScreen target={target} />
    </QueryClientProvider>,
  );
  return user;
}

const row = (name: string | RegExp) => screen.findByRole("row", { name });

function manyLogs(page: number) {
  const first = (page - 1) * PAGE_SIZE;
  const count = Math.min(PAGE_SIZE, MANY - first);
  return Array.from({ length: count }, (_, index) => ({
    id: MANY - first - index,
    action: "DEPARTMENT_UPDATED",
    entity_type: "DEPARTMENT",
    entity_id: 1,
    actor_id: 4,
    actor_name: "Sistem Yöneticisi",
    before: { name: `Eski ad ${first + index + 1}` },
    after: { name: `Yeni ad ${first + index + 1}` },
    ip_address: null,
    created_at: "2026-10-12T08:00:00Z",
  }));
}

describe("AuditLogsScreen", () => {
  it("shows a skeleton while entries load", () => {
    renderScreen();

    expect(screen.getByLabelText("İşlem kayıtları yükleniyor")).toBeInTheDocument();
  });

  it("says who changed what, with before and after in the screens' own words", async () => {
    renderScreen();

    const sla = await row(/Çözüm hedefi/);
    expect(within(sla).getByText("Süre hedefi güncellendi")).toBeInTheDocument();
    expect(await within(sla).findByText("Elektrik arızası · Yüksek")).toBeInTheDocument();
    expect(within(sla).getByText("Sistem Yöneticisi")).toBeInTheDocument();
    expect(within(sla).getByText("2 saat → 3 saat")).toBeInTheDocument();

    const policy = await row(/Yapay zekâ politikası güncellendi/);
    expect(within(policy).getByText("Kendi uygular → Uygular, müdüre haber verir")).toBeInTheDocument();
    expect(within(policy).getByText("%70 → %85")).toBeInTheDocument();
    expect(within(await row(/Birim güncellendi/)).getByText("Aktif → Pasif")).toBeInTheDocument();
    expect(screen.getByText("8 kayıt").closest("[data-slot=admin-table]")).not.toBeNull();
    expect(screen.getByText(/kim, ne zaman, neyi değiştirdi/)).toBeInTheDocument();
  });

  it("keeps the fields of a new record folded until asked", async () => {
    const user = renderScreen();

    const created = await row(/Konum eklendi/);
    // Ad hem baslikta hem (kapali) alan listesinde gecer; gorunen, basliktaki
    expect(within(created).getAllByText("B Blok 3. Kat")[0]).toBeVisible();
    expect(within(created).getByText("Yeni kayıt")).toBeInTheDocument();
    expect(within(created).getByText("Kat")).not.toBeVisible();

    await user.click(within(created).getByText("Alanları göster"));

    expect(within(created).getByText("Kat")).toBeVisible();
    expect(within(created).queryByText("id")).not.toBeInTheDocument();
  });

  it("labels each value for the phone card layout", async () => {
    renderScreen();

    const sla = await row(/Çözüm hedefi/);
    expect(within(sla).getByText("Sistem Yöneticisi").closest("td")).toHaveAttribute("data-label", "Kim");
    expect(within(sla).getByText("2 saat → 3 saat").closest("td")).toHaveAttribute("data-label", "Değişiklik");
  });

  it("filters by record kind on the server and offers to clear when nothing matches", async () => {
    const user = renderScreen();
    await row(/Birim güncellendi/);

    await user.selectOptions(screen.getByLabelText("Kayıt türü"), "Süre hedefi");
    expect(await screen.findByText("3 kayıt")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Birim güncellendi/ })).not.toBeInTheDocument();

    server.use(http.get(apiUrl("/admin/audit-logs"), () => HttpResponse.json({ items: [], total: 0, page: 1 })));
    await user.selectOptions(screen.getByLabelText("Kayıt türü"), "Konum");
    expect(await screen.findByText("Bu filtreye uyan kayıt yok.")).toBeInTheDocument();
    // Bu ekranda arama kutusu yok: "farkli bir kelime deneyin" denmez
    expect(screen.getByText("Farklı bir kayıt türü seçin ya da filtreleri temizleyin.")).toBeInTheDocument();
    expect(screen.queryByText(/kelime/)).not.toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Filtreleri temizle" }));

    expect(await row(/Birim güncellendi/)).toBeInTheDocument();
  });

  it("shows the history of one record with a way back to all entries", async () => {
    renderScreen({ entityType: "SLA_RULE", entityId: 6 });

    expect(await screen.findByText("3 kayıt")).toBeInTheDocument();
    expect(await screen.findByText("Elektrik arızası · Yüksek kaydının geçmişi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tüm kayıtları göster" })).toHaveAttribute("href", "/admin/audit-logs");
    expect(screen.queryByLabelText("Kayıt türü")).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Süre hedefi eklendi/ })).toBeInTheDocument();
  });

  it("pages through many entries", async () => {
    server.use(
      http.get(apiUrl("/admin/audit-logs"), ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({ items: manyLogs(page), total: MANY, page });
      }),
    );
    const user = renderScreen();

    expect(await screen.findByText("1–50 / 120 kayıt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Önceki" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Sonraki" }));
    await user.click(await screen.findByRole("button", { name: "Sonraki" }));

    expect(await screen.findByText("101–120 / 120 kayıt")).toBeInTheDocument();
    expect(screen.getByText("Eski ad 120 → Yeni ad 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sonraki" })).toBeDisabled();
  });

  it("says when nothing has been recorded yet", async () => {
    server.use(http.get(apiUrl("/admin/audit-logs"), () => HttpResponse.json({ items: [], total: 0, page: 1 })));
    renderScreen();

    expect(await screen.findByText("Henüz işlem kaydı yok.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtreleri temizle" })).not.toBeInTheDocument();
  });

  it("shows an error with retry when entries cannot be loaded", async () => {
    server.use(
      http.get(apiUrl("/admin/audit-logs"), () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu.", details: {} } },
          { status: 500 },
        ),
      ),
    );
    renderScreen();

    expect(await screen.findByText("İşlem kayıtları yüklenemedi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});
