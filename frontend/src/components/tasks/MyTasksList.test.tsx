import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";
import { TASKS } from "@/mocks/taskFixtures";

import { MyTasksList } from "./MyTasksList";

function renderList() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MyTasksList />
    </QueryClientProvider>,
  );
}

// Istek adreslerini sahte yaniti degistirmeden dinler (oncelik ve siralama parametreleri)
function listenTo(path: string, asked: URLSearchParams[]) {
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith(path)) {
      asked.push(url.searchParams);
    }
  });
}
afterEach(() => server.events.removeAllListeners());

describe("MyTasksList", () => {
  it("shows a skeleton while the tasks load", () => {
    renderList();

    expect(screen.getByLabelText("Görevler yükleniyor")).toBeInTheDocument();
  });

  it("lists the tasks, most urgent first, each linking to its detail", async () => {
    renderList();

    const links = await screen.findAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/staff/tasks/203");
    expect(within(links[0]!).getByRole("heading", { name: "B Blok 2. Kat Erkek WC" })).toBeInTheDocument();
    expect(within(links[0]!).getByText("Koridorda su birikintisi")).toBeInTheDocument();
    expect(within(links[0]!).getByText(/CASE-000106/)).toBeInTheDocument();
    expect(screen.getByText(/4 açık görev/)).toBeInTheDocument();
  });

  it("tells status, priority and remaining time in words", async () => {
    renderList();

    const late = (await screen.findAllByRole("link"))[0]!;
    expect(within(late).getByText("Çalışılıyor")).toBeInTheDocument();
    expect(within(late).getByText("Yüksek")).toBeInTheDocument();
    expect(within(late).getByText(/gecikti/)).toBeInTheDocument();
  });

  it("explains an empty list", async () => {
    server.use(http.get(apiUrl("/tasks/mine"), () => HttpResponse.json({ items: [], total: 0, page: 1 })));

    renderList();

    expect(await screen.findByText("Şu an bekleyen görevin yok.")).toBeInTheDocument();
  });

  it("shows the backend error and loads again on retry", async () => {
    server.use(
      http.get(
        apiUrl("/tasks/mine"),
        () =>
          HttpResponse.json(
            { error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } },
            { status: 500 },
          ),
        { once: true },
      ),
    );

    renderList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Görevlerin yüklenemedi.");
    expect(alert).toHaveTextContent("Beklenmeyen bir hata oluştu.");

    await userEvent.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect((await screen.findAllByRole("link")).length).toBeGreaterThan(0);
  });

  describe("list tools", () => {
    it("keeps the most urgent first, then sorts and narrows on request", async () => {
      const asked: URLSearchParams[] = [];
      listenTo("/tasks/mine", asked);
      renderList();
      const user = userEvent.setup();
      await screen.findByText(/en acil olan üstte/);
      expect(asked.at(-1)?.has("order")).toBe(false);

      await user.selectOptions(screen.getByRole("combobox", { name: "Sıralama" }), "En yeni");
      await user.click(screen.getByRole("button", { name: "Öncelik: Tümü" }));
      await user.click(await screen.findByRole("checkbox", { name: "Yüksek" }));
      await user.keyboard("{Escape}");

      await waitFor(() => expect(asked.at(-1)?.getAll("priority")).toEqual(["HIGH"]));
      expect(asked.at(-1)?.get("order")).toBe("newest");
      expect(await screen.findByText(/en yeni olan üstte/)).toBeInTheDocument();
    });

    it("shows the tasks as square cards on request", async () => {
      renderList();
      const user = userEvent.setup();
      await screen.findAllByRole("link");

      await user.click(screen.getByRole("button", { name: "Kart görünümü" }));

      expect(screen.getByRole("list", { name: "Görevlerin" })).toHaveAttribute("data-view", "grid");
      expect(screen.getAllByRole("link")[0]).toHaveTextContent("B Blok 2. Kat Erkek WC");
    });

    it("says when no task has the chosen priority and clears it", async () => {
      server.use(
        http.get(apiUrl("/tasks/mine"), ({ request }) =>
          new URL(request.url).searchParams.has("priority")
            ? HttpResponse.json({ items: [], total: 0, page: 1 })
            : HttpResponse.json({ items: TASKS.slice(0, 2), total: 2, page: 1 }),
        ),
      );
      renderList();
      const user = userEvent.setup();

      await user.click(await screen.findByRole("button", { name: "Öncelik: Tümü" }));
      await user.click(await screen.findByRole("checkbox", { name: "Düşük" }));
      await user.keyboard("{Escape}");

      expect(await screen.findByText("Seçtiğin önceliklerde görev yok.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Filtreyi temizle" }));
      expect(await screen.findByRole("button", { name: "Öncelik: Tümü" })).toBeInTheDocument();
    });
  });
});
