import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { USERS } from "@/mocks/fixtures";
import { resetReviewQueue } from "@/mocks/managerHandlers";
import { server } from "@/mocks/node";
import { signInAs } from "@/mocks/session";

import { ManagerCaseDetail } from "./ManagerCaseDetail";

// jsdom'da createObjectURL yok (tum tarayicilarda var)
URL.createObjectURL = () => "blob:foto";

// Sahte listedeki bildirimler (mocks/managerCaseFixtures.ts)
const AUTO_ASSIGNED = "301";
const NO_DECISIONS = "302";
const ESCALATED = "303";
// Inceleme kuyrugundaki bildirimler (mocks/managerFixtures.ts)
const IN_QUEUE_SAFETY = "131";
const IN_QUEUE_DUPLICATE = "128";

function renderDetail(caseId: string, view: "all" | "unit" = "all") {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ManagerCaseDetail caseId={caseId} view={view} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const title = () => screen.findByRole("heading", { level: 1 });

// Sahte kuyruk modul icinde tutulur; her test ayni baslangic durumundan baslasin
beforeEach(() => {
  resetReviewQueue();
  signInAs(USERS.MANAGER);
});
afterEach(() => signInAs(null));

describe("ManagerCaseDetail", () => {
  it("shows a skeleton while the case loads", () => {
    renderDetail(AUTO_ASSIGNED);

    expect(screen.getByLabelText("Bildirim yükleniyor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tüm Bildirimler" })).toHaveAttribute("href", "/manager/cases");
  });

  it("shows the case with its status, priority, time left and details", async () => {
    renderDetail(AUTO_ASSIGNED);

    expect(await title()).toHaveTextContent("B Blok Zemin Kat WC'de sabun bitmiş");
    expect(screen.getByText(/CASE-000301/)).toBeInTheDocument();
    const badges = screen.getByRole("list", { name: "Durum" });
    expect(badges).toHaveTextContent("Atandı");
    expect(badges).toHaveTextContent("Düşük");
    expect(badges).toHaveTextContent(/1 sa \d+ dk kaldı/);
    const info = screen.getByRole("region", { name: "Bildirim bilgileri" });
    expect(within(info).getByText("Konum").nextElementSibling).toHaveTextContent("B Blok Zemin Kat WC");
    expect(within(info).getByText("Tür").nextElementSibling).toHaveTextContent("Sabun bitti · Sarf malzemesi");
    expect(within(info).getByText("Birim").nextElementSibling).toHaveTextContent("Destek Hizmetleri Şube Müdürlüğü");
    expect(screen.queryByText(/kararınızı bekliyor/)).not.toBeInTheDocument();
  });

  it("explains every AI step with its decision, reasons, model and confidence", async () => {
    renderDetail(AUTO_ASSIGNED);

    const list = await screen.findByRole("list", { name: "Yapay zekâ kararları" });
    // Gerekce maddeleri de liste ogesidir; adimlar listenin dogrudan cocuklaridir
    const steps = [...list.children];
    expect(steps).toHaveLength(6);
    expect(steps[0]).toHaveTextContent("Ön inceleme");
    expect(steps[1]).toHaveTextContent("Sınıflandırma");
    expect(steps[1]).toHaveTextContent("Sabun bitti");
    expect(steps[1]).toHaveTextContent("Model tahmini: Sabun bitti (%94)");
    expect(steps[1]).toHaveTextContent("tfidf-logreg@1.0");
    expect(steps[1]).toHaveTextContent("Güven %94");
    expect(steps[3]).toHaveTextContent("Bildirim türünün ciddiyeti +8");
    expect(steps[5]).toHaveTextContent("Görev personele atandı");
  });

  it("says so when the AI made no decision for the case", async () => {
    renderDetail(NO_DECISIONS);

    expect(await screen.findByText("Bu bildirim için yapay zekâ kararı yok.")).toBeInTheDocument();
  });

  it("lists what happened with who did it", async () => {
    const user = renderDetail(AUTO_ASSIGNED);
    await user.click(await screen.findByRole("button", { name: /önceki adımı göster/ }));

    const events = within(screen.getByRole("list", { name: "Zaman çizelgesi" })).getAllByRole("listitem");
    expect(events[0]).toHaveTextContent("Bildirim açıldı");
    expect(events[0]).toHaveTextContent("Bildiren");
    expect(events[1]).toHaveTextContent("Sistem");
    expect(events[2]).toHaveTextContent("Tür belirlendi");
    expect(events[2]).toHaveTextContent("Yapay zekâ · Sınıflandırma");
    expect(events.at(-1)).toHaveTextContent("Görev açıldı");
  });

  it("shows the latest three steps first and opens the earlier ones on request", async () => {
    const user = renderDetail(AUTO_ASSIGNED);

    const list = await screen.findByRole("list", { name: "Zaman çizelgesi" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getAllByRole("listitem").at(-1)).toHaveTextContent("Görev açıldı");
    const toggle = screen.getByRole("button", { name: /önceki adımı göster/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Bildirim açıldı");
    expect(screen.getByRole("button", { name: "Önceki adımları gizle" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the photos of the case and hides the section when there are none", async () => {
    renderDetail(AUTO_ASSIGNED);

    expect(await screen.findByRole("img", { name: "Bildirim fotoğrafı 1" })).toBeInTheDocument();
  });

  it("has no photo section for a case without photos", async () => {
    renderDetail(NO_DECISIONS);

    await title();
    await screen.findByRole("list", { name: "Zaman çizelgesi" });
    expect(screen.queryByRole("heading", { name: "Fotoğraflar" })).not.toBeInTheDocument();
  });

  it("points to the review queue when the case waits for the manager", async () => {
    renderDetail(ESCALATED);

    expect(await title()).toHaveTextContent("Asansör katlar arasında kaldı");
    // Karar kutusu rol (mudur) bilinince cikar
    expect(await screen.findByText("Bu bildirim kararınızı bekliyor.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "İnceleme Kuyruğu'na git" })).toHaveAttribute("href", "/manager/review-queue");
  });

  it("lets the manager decide right here when the case is in the review queue", async () => {
    const user = renderDetail(IN_QUEUE_SAFETY);

    const decision = await screen.findByRole("region", { name: "Bu bildirim kararınızı bekliyor" });
    expect(decision).toHaveTextContent("Neden burada?");
    expect(decision).toHaveTextContent("Güvenlik açısından kritik ya da insan kararı gerektiren tür; müdüre iletilir.");
    expect(within(decision).getByRole("button", { name: "Düzelt" })).toBeInTheDocument();
    expect(within(decision).getByRole("button", { name: "Reddet" })).toBeInTheDocument();
    await user.click(within(decision).getByRole("button", { name: "Onayla ve ata" }));

    expect(await screen.findByRole("status")).toHaveTextContent("CASE-000131 atandı.");
    await waitFor(() => expect(screen.getByRole("list", { name: "Durum" })).toHaveTextContent("Atandı"));
    expect(screen.queryByRole("region", { name: "Bu bildirim kararınızı bekliyor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Onayla ve ata" })).not.toBeInTheDocument();
  });

  it("offers merging with the similar case the AI found", async () => {
    renderDetail(IN_QUEUE_DUPLICATE);

    const decision = await screen.findByRole("region", { name: "Bu bildirim kararınızı bekliyor" });
    expect(decision).toHaveTextContent("Benzer bildirim: CASE-000102 · Amfide projeksiyon çalışmıyor");
    expect(within(decision).getByRole("button", { name: "Birleştir" })).toBeInTheDocument();
  });

  // Personel kararlari goremez (backend 403); bilgiler, zaman cizelgesi ve yorumlar kalir
  it("shows staff the case without the AI decisions and sends them back to the unit list", async () => {
    signInAs(USERS.STAFF);
    renderDetail(AUTO_ASSIGNED, "unit");

    expect(await title()).toHaveTextContent("B Blok Zemin Kat WC'de sabun bitmiş");
    expect(screen.getByRole("link", { name: "Birim Bildirimleri" })).toHaveAttribute("href", "/staff/cases");
    expect(await screen.findByRole("heading", { name: "Zaman çizelgesi" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Yapay zekâ kararları" })).not.toBeInTheDocument();
  });

  // Karar yalniz mudurun; yonetici kararlari okur ama karar kutusu cikmaz
  it("shows the admin the AI decisions without the decision box", async () => {
    signInAs(USERS.ADMIN);
    renderDetail(IN_QUEUE_SAFETY);

    expect(await title()).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Yapay zekâ kararları" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Onayla ve ata" })).not.toBeInTheDocument();
  });

  it("does not reveal whether a missing case exists", async () => {
    renderDetail("999999");

    expect(await screen.findByText("Kayıt bulunamadı")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tüm Bildirimler'e dön" })).toHaveAttribute("href", "/manager/cases");
  });

  it("shows the error with a retry that loads the case", async () => {
    server.use(
      http.get(apiUrl("/cases/:id"), () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
      ),
    );
    const user = renderDetail(AUTO_ASSIGNED);

    expect(await screen.findByText("Bildirim yüklenemedi.")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(await title()).toHaveTextContent("B Blok Zemin Kat WC'de sabun bitmiş");
  });
});
