import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { MyTasksList } from "./MyTasksList";

function renderList() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MyTasksList />
    </QueryClientProvider>,
  );
}

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
});
