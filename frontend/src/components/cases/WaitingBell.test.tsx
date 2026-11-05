import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { CASES } from "@/mocks/caseFixtures";
import { server } from "@/mocks/node";

import { WaitingBell } from "./WaitingBell";

type Case = (typeof CASES)[number];

function serveCases(items: Case[]) {
  server.use(http.get(apiUrl("/cases/mine"), () => HttpResponse.json({ items, total: items.length, page: 1 })));
}

function renderBell() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WaitingBell />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const closedYesterday = () => new Date(Date.now() - 24 * 3_600_000).toISOString();

describe("WaitingBell", () => {
  it("turns orange and opens the cases waiting for the reporter, newest need first", async () => {
    serveCases([
      { ...CASES[0]!, id: 501, title: "Projeksiyon çalışmıyor", status: "NEEDS_INFO" },
      { ...CASES[0]!, id: 502, title: "Sabun bitmiş", status: "CLOSED", closed_at: closedYesterday(), satisfaction_rating: null },
      { ...CASES[0]!, id: 503, title: "Kapı kilitli", status: "ASSIGNED" },
    ]);
    const user = renderBell();

    const bell = await screen.findByRole("button", { name: "Bildirimler: 2 yanıt bekliyor" });
    expect(bell).toHaveAttribute("data-waiting", "true");

    await user.click(bell);

    const panel = await screen.findByRole("dialog", { name: "Sizden yanıt bekleniyor (2)" });
    const links = within(panel).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/cases/501", "/cases/502"]);
    expect(links[0]).toHaveTextContent("Sizden ek bilgi istendi");
    expect(links[1]).toHaveTextContent("Çözüldü · değerlendirmenizi bekliyor");
  });

  it("closes the window when a case is chosen", async () => {
    serveCases([{ ...CASES[0]!, id: 501, title: "Projeksiyon çalışmıyor", status: "NEEDS_INFO" }]);
    const user = renderBell();
    await user.click(await screen.findByRole("button", { name: "Bildirimler: 1 yanıt bekliyor" }));

    await user.click(within(await screen.findByRole("dialog")).getByRole("link", { name: /Projeksiyon çalışmıyor/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays grey and says so when nothing waits", async () => {
    serveCases([{ ...CASES[0]!, id: 503, title: "Kapı kilitli", status: "ASSIGNED" }]);
    const user = renderBell();

    const bell = await screen.findByRole("button", { name: "Bildirimler: yanıt bekleyen yok" });
    expect(bell).toHaveAttribute("data-waiting", "false");

    await user.click(bell);

    expect(await screen.findByText("Şu an sizden yanıt bekleyen bildirim yok.")).toBeInTheDocument();
  });
});
