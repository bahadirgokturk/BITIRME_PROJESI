import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import type { PendingReport } from "@/lib/pendingReports";
import { memoryStore, setPendingStore } from "@/lib/pendingStore";
import { createQueryClient } from "@/lib/queryClient";
import { USERS } from "@/mocks/fixtures";
import { server } from "@/mocks/node";
import { signInAs } from "@/mocks/session";

import { PendingReports, PendingSync } from "./PendingReports";
import { ReportScreen } from "./ReportScreen";

const REPORTER = USERS.REPORTER;
const photo = () => new File(["png"], "sabun.png", { type: "image/png" });
let store: ReturnType<typeof memoryStore>;
let asked: string[];

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

function renderWithClient(ui: React.ReactNode) {
  const user = userEvent.setup();
  render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);
  return user;
}

async function fillValidReport(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Ne oldu?"), "B blok 2. kat erkek tuvalette sabun bitmiş");
  await user.click(await screen.findByRole("button", { name: "B Blok 2. Kat Erkek WC" }));
}

function waiting(overrides: Partial<PendingReport> = {}): PendingReport {
  return {
    id: "p1",
    userId: REPORTER.id,
    description: "Amfide projeksiyon görüntü vermiyor, ders başlamak üzere.",
    locationId: 1,
    files: [],
    savedAt: "2026-10-29T11:05:00Z",
    error: null,
    ...overrides,
  };
}

const postedCases = () => asked.filter((entry) => entry === "POST /cases").length;

beforeEach(() => {
  store = memoryStore();
  setPendingStore(store);
  signInAs(REPORTER);
  asked = [];
  server.events.on("request:start", ({ request }) => {
    asked.push(`${request.method} ${new URL(request.url).pathname.replace(/^\/api\/v1/, "")}`);
  });
});

afterEach(() => {
  server.events.removeAllListeners();
  // TanStack Query de "online" olayini dinler: sonraki test cevrimdisi baslamasin
  setOnline(true);
  delete (window.navigator as { onLine?: boolean }).onLine;
  setPendingStore(undefined);
  signInAs(null);
});

describe("sending a report without internet", () => {
  it("saves the report on this device instead of sending it and says it will go later", async () => {
    const user = renderWithClient(<ReportScreen />);
    await fillValidReport(user);
    await user.upload(screen.getByLabelText("Fotoğraf ya da video ekle"), photo());
    setOnline(false);

    expect(await screen.findByText(/İnternet yok: bildirimin bu cihaza kaydedilir/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kaydet, internet gelince gönder" }));

    expect(await screen.findByRole("heading", { name: "Bildiriminiz kaydedildi" })).toBeInTheDocument();
    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toMatchObject({ userId: REPORTER.id, error: null });
    expect(store.items[0]?.files.map((file) => file.name)).toEqual(["sabun.png"]);
    expect(postedCases()).toBe(0);
  });

  it("saves the report when the connection drops while sending", async () => {
    server.use(http.post(apiUrl("/cases"), () => HttpResponse.error()));
    const user = renderWithClient(<ReportScreen />);
    await fillValidReport(user);

    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByRole("heading", { name: "Bildiriminiz kaydedildi" })).toBeInTheDocument();
    expect(store.items).toHaveLength(1);
  });

  it("keeps the form and shows the backend error instead of saving a refused report", async () => {
    server.use(
      http.post(apiUrl("/cases"), () =>
        HttpResponse.json({ error: { code: "VALIDATION", message: "Konum geçersiz.", details: {} } }, { status: 422 }),
      ),
    );
    const user = renderWithClient(<ReportScreen />);
    await fillValidReport(user);

    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByText("Konum geçersiz.")).toBeInTheDocument();
    expect(store.items).toHaveLength(0);
  });

  // Bildirim kayitli: yeniden gonderilirse iki kez olusurdu
  it("keeps a saved report when only the photo upload loses the connection", async () => {
    server.use(http.post(apiUrl("/cases/:id/attachments"), () => HttpResponse.error()));
    const user = renderWithClient(<ReportScreen />);
    await fillValidReport(user);
    await user.upload(screen.getByLabelText("Fotoğraf ya da video ekle"), photo());

    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByRole("heading", { name: "Bildiriminiz alındı, inceleniyor" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("sabun.png: Bağlantı koptuğu için yüklenemedi.");
    expect(store.items).toHaveLength(0);
  });
});

describe("waiting reports", () => {
  it("lists what waits and says it goes when the connection is back", async () => {
    await store.put(waiting());
    setOnline(false);
    renderWithClient(<PendingReports />);

    const box = await screen.findByRole("region", { name: "Gönderilmeyi bekleyen 1 bildirim" });
    expect(within(box).getByText(/Amfide projeksiyon/)).toBeInTheDocument();
    expect(within(box).getByText("İnternet gelince gönderilecek.")).toBeInTheDocument();
  });

  it("shows nothing when no report waits", async () => {
    renderWithClient(<PendingReports />);

    await waitFor(() => expect(asked).toContain("GET /auth/me"));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("sends a waiting report when online and names the case it became", async () => {
    await store.put(waiting());
    renderWithClient(
      <>
        <PendingSync />
        <PendingReports />
      </>,
    );

    expect(await screen.findByText(/^Bekleyen bildirimin gönderildi: CASE-/)).toBeInTheDocument();
    expect(store.items).toHaveLength(0);
    expect(postedCases()).toBe(1);
  });

  it("keeps a refused report with the reason and lets the reporter delete it", async () => {
    server.use(
      http.post(apiUrl("/cases"), () =>
        HttpResponse.json(
          { error: { code: "VALIDATION", message: "Konum artık kullanılmıyor.", details: {} } },
          { status: 422 },
        ),
      ),
    );
    await store.put(waiting());
    const user = renderWithClient(
      <>
        <PendingSync />
        <PendingReports />
      </>,
    );

    expect(await screen.findByText("Gönderilemedi: Konum artık kullanılmıyor.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Sil/ }));

    await waitFor(() => expect(store.items).toHaveLength(0));
    expect(postedCases()).toBe(1);
  });

  it("does not send another user's waiting report", async () => {
    await store.put(waiting({ userId: REPORTER.id + 1000 }));
    renderWithClient(
      <>
        <PendingSync />
        <PendingReports />
      </>,
    );

    await waitFor(() => expect(asked).toContain("GET /auth/me"));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(postedCases()).toBe(0);
  });
});
