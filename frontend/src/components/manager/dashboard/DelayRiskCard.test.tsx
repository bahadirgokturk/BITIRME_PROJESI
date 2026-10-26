import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import type { DelayRiskRead } from "@/lib/delayRisk";
import { createQueryClient } from "@/lib/queryClient";
import { DELAY_RISK, DELAY_RISK_NO_MODEL } from "@/mocks/analyticsFixtures";
import { server } from "@/mocks/node";

import { DelayRiskCard } from "./DelayRiskCard";

function renderCard() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DelayRiskCard />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const region = () => screen.findByRole("region", { name: "Gecikme riski" });
const answer = (body: DelayRiskRead) =>
  server.use(http.get(apiUrl("/analytics/delay-risk"), () => HttpResponse.json(body)));
const failure = () =>
  HttpResponse.json({ error: { code: "INTERNAL", message: "Risk hesaplanamadı.", details: {} } }, { status: 500 });

describe("DelayRiskCard", () => {
  it("shows a placeholder while the risk is computed", () => {
    renderCard();

    expect(screen.getByLabelText("Gecikme riski yükleniyor")).toHaveAttribute("aria-busy", "true");
  });

  it("lists the riskiest open cases first with the level, the target time and the reasons", async () => {
    renderCard();

    const card = await region();
    expect(within(card).getByRole("heading", { name: "1 bildirim yüksek gecikme riskinde" })).toBeInTheDocument();
    const rows = within(card).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Yüksek risk · %78");
    expect(rows[0]).toHaveTextContent("Geçen süre %62");
    expect(rows[0]).toHaveTextContent("Neden: Mesai dışında açıldı · Açıldığında birimde 14 açık iş");
    expect(within(rows[0]!).getByRole("link", { name: "Asansör kat arasında kaldı" })).toHaveAttribute(
      "href",
      "/manager/cases/612",
    );
    expect(within(card).getByText(/AUC 0,85 \(iyi\)/)).toBeInTheDocument();
  });

  it("points to the cases that are already late", async () => {
    renderCard();

    const card = await region();
    expect(within(card).getByText("3 bildirimin hedef süresi zaten geçti.")).toBeInTheDocument();
    const late = within(card).getByRole("link", { name: "Gecikenleri gör" });
    expect(late).toHaveAttribute("href", "/manager/cases?group=late");
  });

  it("shows five cases first and the rest on request", async () => {
    const user = renderCard();

    const card = await region();
    expect(within(card).getAllByRole("listitem")).toHaveLength(5);

    const total = DELAY_RISK.items.length;
    await user.click(within(card).getByRole("button", { name: `${total} bildirimin hepsini göster` }));

    expect(within(card).getAllByRole("listitem")).toHaveLength(DELAY_RISK.items.length);
  });

  it("explains that nothing is at risk when every open case is already late", async () => {
    answer({ ...DELAY_RISK, items: [], already_late: 29 });
    renderCard();

    const card = await region();
    expect(within(card).getByText(/^Süresi dolmamış açık bildirim yok/)).toBeInTheDocument();
    expect(within(card).getByText("29 bildirimin hedef süresi zaten geçti.")).toBeInTheDocument();
    expect(within(card).queryByRole("list")).not.toBeInTheDocument();
  });

  it("passes on why there is no model yet", async () => {
    answer(DELAY_RISK_NO_MODEL);
    renderCard();

    const card = await region();
    expect(within(card).getByText(DELAY_RISK_NO_MODEL.message!)).toBeInTheDocument();
    expect(within(card).queryByText(/AUC/)).not.toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: "Gecikenleri gör" })).not.toBeInTheDocument();
  });

  it("shows the backend error with a retry", async () => {
    server.use(http.get(apiUrl("/analytics/delay-risk"), failure));
    renderCard();

    expect(await screen.findByText("Risk hesaplanamadı.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});
