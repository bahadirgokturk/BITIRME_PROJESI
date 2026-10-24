import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { MY_CASES_PAGE_SIZE } from "@/lib/status";
import { CASES } from "@/mocks/caseFixtures";
import { server } from "@/mocks/node";

import { MyCasesList } from "./MyCasesList";

function renderList() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MyCasesList />
    </QueryClientProvider>,
  );
}

// 25 bildirimi backend gibi sayfalara boler; secilen sayfa hata donebilir
function servePaged({ failPage }: { failPage?: number } = {}) {
  const items = Array.from({ length: 25 }, (_, i) => ({
    ...CASES[0],
    id: 1000 + i,
    case_number: `CASE-${String(1000 + i).padStart(6, "0")}`,
    title: `Bildirim ${i + 1}`,
  }));
  server.use(
    http.get(apiUrl("/cases/mine"), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const number = Number(params.get("page") ?? "1");
      const size = Number(params.get("page_size") ?? "20");
      if (number === failPage) {
        return HttpResponse.json(
          { error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } },
          { status: 500 },
        );
      }
      const slice = items.slice((number - 1) * size, number * size);
      return HttpResponse.json({ items: slice, total: items.length, page: number });
    }),
  );
}

// Yalniz listenin sayfa istegi duser; "yanit bekleniyor" kutusunun istegi (page_size=100) normal cevap alir
function failOnce(status: number, message: string) {
  let failed = false;
  server.use(
    http.get(apiUrl("/cases/mine"), ({ request }) => {
      const isListPage = new URL(request.url).searchParams.get("page_size") === String(MY_CASES_PAGE_SIZE);
      if (failed || !isListPage) {
        return undefined;
      }
      failed = true;
      return HttpResponse.json({ error: { code: "INTERNAL", message, details: {} } }, { status });
    }),
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

    const list = await screen.findByRole("list", { name: "Bildirimleriniz" });
    const link = within(list).getByRole("link", { name: /Amfide garip bir koku var/ });
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

  it("does not offer more when every case is already shown", async () => {
    renderList();

    await screen.findByRole("link", { name: /Tuvalette sabun bitmiş/ });
    expect(screen.queryByRole("button", { name: "Daha fazla göster" })).not.toBeInTheDocument();
  });

  it("loads the next page with Daha fazla göster", async () => {
    servePaged();
    renderList();

    expect(await screen.findByRole("link", { name: /Bildirim 20\b/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Bildirim 21\b/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Daha fazla göster" }));

    expect(await screen.findByRole("link", { name: /Bildirim 25\b/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Daha fazla göster" })).not.toBeInTheDocument();
  });

  it("keeps the loaded cases and offers a retry when the next page fails", async () => {
    servePaged({ failPage: 2 });
    renderList();

    await userEvent.click(await screen.findByRole("button", { name: "Daha fazla göster" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Beklenmeyen bir hata oluştu.");
    expect(within(alert).getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bildirim 1\b/ })).toBeInTheDocument();
  });

  it("filters the reporter's own cases into open and solved", async () => {
    const asked: string[][] = [];
    server.use(
      http.get(apiUrl("/cases"), ({ request }) => {
        const statuses = new URL(request.url).searchParams.getAll("status");
        asked.push(statuses);
        const solved = statuses.includes("CLOSED");
        const item = { ...CASES[0]!, id: 2001, title: solved ? "Çözülen bildirim" : "Açık bildirim" };
        return HttpResponse.json({ items: [item], total: 1, page: 1 });
      }),
    );
    renderList();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Açık" }));

    expect(await screen.findByText("Açık bildirim")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Açık" })).toHaveAttribute("aria-pressed", "true");
    expect(asked.at(-1)).toContain("IN_PROGRESS");
    expect(asked.at(-1)).not.toContain("CLOSED");

    await user.click(screen.getByRole("button", { name: "Çözülen" }));

    expect(await screen.findByText("Çözülen bildirim")).toBeInTheDocument();
    expect(asked.at(-1)).toEqual(["RESOLVED", "VERIFICATION", "CLOSED"]);
  });

  it("says when no case matches the filter and offers to show them all", async () => {
    server.use(http.get(apiUrl("/cases"), () => HttpResponse.json({ items: [], total: 0, page: 1 })));
    renderList();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Açık" }));

    expect(await screen.findByText("Açık bildiriminiz yok.")).toBeInTheDocument();
    // Bildirim yap dugmesi ustte kalir: bildirenin baska bildirimleri var
    expect(screen.getByRole("link", { name: "Bildirim yap" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tümünü göster" }));

    expect(screen.getByRole("button", { name: "Tümü" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findAllByRole("link", { name: /CASE-/ })).not.toHaveLength(0);
  });

  it("offers no filter before the reporter has any case", async () => {
    server.use(http.get(apiUrl("/cases/mine"), () => HttpResponse.json({ items: [], total: 0, page: 1 })));
    renderList();

    expect(await screen.findByText("Henüz bildiriminiz yok.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Durum" })).not.toBeInTheDocument();
  });
});
