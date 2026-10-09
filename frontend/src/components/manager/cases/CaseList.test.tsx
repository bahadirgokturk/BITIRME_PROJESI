import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { CaseList } from "./CaseList";

function renderList() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CaseList />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const rows = () => within(screen.getByRole("list", { name: "Bildirimler" })).getAllByRole("listitem");
const waitForRows = (count: number) => waitFor(() => expect(rows()).toHaveLength(count));

describe("CaseList", () => {
  it("shows a skeleton while the cases load", () => {
    renderList();

    expect(screen.getByRole("heading", { level: 1, name: "Tüm Bildirimler" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bildirimler yükleniyor")).toBeInTheDocument();
  });

  it("lists the newest cases with unit, priority, status and time left, each linking to its detail", async () => {
    renderList();

    await screen.findByRole("list", { name: "Bildirimler" });
    expect(rows()).toHaveLength(20);
    const first = rows()[0]!;
    expect(within(first).getByRole("link")).toHaveAttribute("href", "/cases/301");
    expect(first).toHaveTextContent("CASE-000301");
    expect(first).toHaveTextContent("B Blok Zemin Kat WC'de sabun bitmiş");
    expect(first).toHaveTextContent("Sabun bitti · B Blok Zemin Kat WC");
    expect(first).toHaveTextContent("Destek Hizmetleri Şube Müdürlüğü");
    expect(first).toHaveTextContent("Düşük");
    expect(first).toHaveTextContent("Atandı");
    expect(first).toHaveTextContent(/1 sa \d+ dk kaldı/);
    expect(rows()[2]).toHaveTextContent("Müdüre yükseltildi");
    expect(rows()[2]).toHaveTextContent(/\d+ dk gecikti/);
  });

  it("loads the rest on request and says how many are shown", async () => {
    const user = renderList();

    expect(await screen.findByText("28 bildirimin ilk 20 tanesi gösteriliyor")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Daha fazla göster" }));

    await waitForRows(28);
    expect(screen.getByText("28 bildirim")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Daha fazla göster" })).not.toBeInTheDocument();
  });

  it("narrows the list by status group", async () => {
    const user = renderList();
    await screen.findByRole("list", { name: "Bildirimler" });
    expect(screen.getByRole("button", { name: "Tümü" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Geciken" }));

    await waitForRows(3);
    expect(screen.getByRole("button", { name: "Geciken" })).toHaveAttribute("aria-pressed", "true");
    rows().forEach((row) => expect(row).toHaveTextContent("gecikti"));

    await user.click(screen.getByRole("button", { name: "Reddedilen ve birleştirilen" }));

    await waitForRows(6);
  });

  it("narrows the list by priority and by search text", async () => {
    const user = renderList();
    await screen.findByRole("list", { name: "Bildirimler" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Öncelik" }), "Kritik");

    await waitForRows(3);
    rows().forEach((row) => expect(row).toHaveTextContent("Asansör katlar arasında kaldı"));

    await user.selectOptions(screen.getByRole("combobox", { name: "Öncelik" }), "Tüm öncelikler");
    await user.type(screen.getByRole("searchbox", { name: "Bildirim ara" }), "kantin");

    await waitForRows(3);
    rows().forEach((row) => expect(row).toHaveTextContent("Kantin fiyat listesi hakkında"));
  });

  it("explains an empty search result and clears the filters on request", async () => {
    const user = renderList();
    await screen.findByRole("list", { name: "Bildirimler" });

    await user.type(screen.getByRole("searchbox", { name: "Bildirim ara" }), "olmayan kelime");

    expect(await screen.findByText("Aramanıza uyan bildirim yok.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Süzgeçleri temizle" }));

    await waitForRows(20);
    expect(screen.getByRole("searchbox", { name: "Bildirim ara" })).toHaveValue("");
  });

  it("says the list covers the whole institution (a manager sees every unit's cases)", () => {
    renderList();

    expect(screen.getByText(/^Kurumdaki bütün bildirimler\./)).toBeInTheDocument();
  });

  it("says so when there are no cases yet", async () => {
    server.use(http.get(apiUrl("/cases"), () => HttpResponse.json({ items: [], total: 0, page: 1 })));
    renderList();

    expect(await screen.findByText("Henüz bildirim yok.")).toBeInTheDocument();
    expect(screen.getByText("Bir bildirim geldiğinde burada görünür.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Süzgeçleri temizle" })).not.toBeInTheDocument();
  });

  it("shows the backend error and loads again on retry", async () => {
    server.use(
      http.get(
        apiUrl("/cases"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bildirimler yüklenemedi.");
    expect(alert).toHaveTextContent("Beklenmeyen bir hata oluştu.");

    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    await waitForRows(20);
  });
});
