import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { resetReviewQueue } from "@/mocks/managerHandlers";
import { server } from "@/mocks/node";

import { ReviewQueue } from "./ReviewQueue";

const SAFETY = "Laboratuvarda priz kıvılcım çıkarıyor";
const DUPLICATE = "Amfide projeksiyon yine bozuk";
const UNSURE = "Koridorda garip bir ses var";

function renderQueue() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ReviewQueue />
    </QueryClientProvider>,
  );
  return user;
}

const card = (title: string) => screen.findByRole("article", { name: title });

function errorBody(code: string, message: string) {
  return { error: { code, message, details: {} } };
}

// Sahte kuyruk modul icinde tutulur; her test ayni baslangic durumundan baslasin
beforeEach(() => resetReviewQueue());

describe("ReviewQueue", () => {
  it("shows a skeleton while the queue loads", () => {
    renderQueue();

    expect(screen.getByLabelText("İnceleme kuyruğu yükleniyor")).toBeInTheDocument();
  });

  it("explains why each case is here, how sure the AI is and what it suggests", async () => {
    renderQueue();

    const safety = await card(SAFETY);
    expect(within(safety).getByText("Yöneticiye iletildi")).toBeInTheDocument();
    expect(within(safety).getByText("Güven %91")).toBeInTheDocument();
    expect(within(safety).getByText(/müdüre iletilir/)).toBeInTheDocument();
    expect(within(safety).getByText("Elektrik arızası")).toBeInTheDocument();
    expect(within(safety).getByText("Kritik")).toBeInTheDocument();
    expect(screen.getByText("3 bildirim")).toBeInTheDocument();
  });

  it("opens the AI decision panel with every agent's reasons and model", async () => {
    const user = renderQueue();
    const safety = await card(SAFETY);

    await user.click(within(safety).getByRole("button", { name: "AI gerekçesi" }));

    const panel = await within(safety).findByRole("list", { name: "AI kararları" });
    expect(within(panel).getByText("Sınıflandırma")).toBeInTheDocument();
    expect(within(panel).getByText(/kıvılcım/)).toBeInTheDocument();
    expect(within(panel).getByText("tfidf-logreg@2026.10.1")).toBeInTheDocument();
    // Kararlarin Turkce adi API'den gelir (decision_label); kod gosterilmez
    expect(within(panel).getByText("Müdüre yükseltildi")).toBeInTheDocument();
    expect(within(panel).queryByText("ESCALATE")).not.toBeInTheDocument();
  });

  it("approves the suggestion and assigns the case to the suggested department", async () => {
    const user = renderQueue();
    const safety = await card(SAFETY);

    await user.click(within(safety).getByRole("button", { name: "Onayla ve ata" }));

    await waitFor(() => expect(screen.queryByRole("article", { name: SAFETY })).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("CASE-000131 atandı.");
  });

  it("requires a reason before rejecting", async () => {
    const user = renderQueue();
    await user.click(within(await card(UNSURE)).getByRole("button", { name: "Reddet" }));

    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Reddet" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Gerekçe (zorunlu)"), "Kampüs dışı bir talep.");
    await user.click(confirm);

    await waitFor(() => expect(screen.queryByRole("article", { name: UNSURE })).not.toBeInTheDocument());
  });

  it("corrects the priority with a reason", async () => {
    const user = renderQueue();
    await user.click(within(await card(SAFETY)).getByRole("button", { name: "Düzelt" }));

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Düzeltilecek alan"), "Öncelik");
    await user.selectOptions(within(dialog).getByLabelText("Yeni değer"), "Yüksek");
    await user.type(within(dialog).getByLabelText("Gerekçe (zorunlu)"), "Kıvılcım bağlı cihazdan geliyor.");
    await user.click(within(dialog).getByRole("button", { name: "Düzeltmeyi kaydet" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await card(SAFETY)).getByText("Yüksek")).toBeInTheDocument();
  });

  it("corrects the department from the department list", async () => {
    const user = renderQueue();
    await user.click(within(await card(UNSURE)).getByRole("button", { name: "Düzelt" }));

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Düzeltilecek alan"), "Birim");
    await within(dialog).findByRole("option", { name: "Bakım Onarım ve Peyzaj Şube Müdürlüğü" });
    await user.selectOptions(within(dialog).getByLabelText("Yeni değer"), "Bakım Onarım ve Peyzaj Şube Müdürlüğü");
    await user.type(within(dialog).getByLabelText("Gerekçe (zorunlu)"), "Ses havalandırma tesisatından geliyor.");
    await user.click(within(dialog).getByRole("button", { name: "Düzeltmeyi kaydet" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await card(UNSURE)).getByText("Bakım Onarım ve Peyzaj Şube Müdürlüğü")).toBeInTheDocument();
  });

  it("offers merging only for a possible duplicate and names the other case", async () => {
    const user = renderQueue();
    expect(within(await card(UNSURE)).queryByRole("button", { name: "Birleştir" })).not.toBeInTheDocument();

    await user.click(within(await card(DUPLICATE)).getByRole("button", { name: "Birleştir" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("CASE-000102");
    await user.type(within(dialog).getByLabelText("Gerekçe (zorunlu)"), "Aynı projeksiyon arızası.");
    await user.click(within(dialog).getByRole("button", { name: "Birleştir" }));

    await waitFor(() => expect(screen.queryByRole("article", { name: DUPLICATE })).not.toBeInTheDocument());
  });

  it("keeps the dialog open and shows the backend error when an action fails", async () => {
    server.use(
      http.post(apiUrl("/cases/:id/reject"), () =>
        HttpResponse.json(errorBody("INVALID_TRANSITION", "Bu bildirim şu an reddedilemez."), { status: 409 }),
      ),
    );
    const user = renderQueue();
    await user.click(within(await card(UNSURE)).getByRole("button", { name: "Reddet" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Gerekçe (zorunlu)"), "Kapsam dışı.");
    await user.click(within(dialog).getByRole("button", { name: "Reddet" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Bu bildirim şu an reddedilemez.");
  });

  it("says when there is nothing to review", async () => {
    server.use(http.get(apiUrl("/manager/review-queue"), () => HttpResponse.json({ items: [], total: 0, page: 1 })));

    renderQueue();

    expect(await screen.findByText("İncelenecek bildirim yok.")).toBeInTheDocument();
  });

  it("shows an error with retry when the queue cannot be loaded", async () => {
    server.use(
      http.get(
        apiUrl("/manager/review-queue"),
        () => HttpResponse.json(errorBody("INTERNAL", "Beklenmeyen bir hata oluştu."), { status: 500 }),
        { once: true },
      ),
    );
    const user = renderQueue();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("İnceleme kuyruğu yüklenemedi.");
    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await card(SAFETY)).toBeInTheDocument();
  });
});
