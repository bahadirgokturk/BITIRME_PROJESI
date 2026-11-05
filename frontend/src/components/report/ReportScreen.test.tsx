import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { LocationOption } from "@/hooks/useReport";
import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { LOCATION_VISIBLE_ROWS } from "@/lib/report";
import { server } from "@/mocks/node";

import { ReportScreen } from "./ReportScreen";

function renderScreen(qrLocation?: string) {
  // applyAccept kapali: input'un accept filtresini atlayip yanlis turdeki dosyayi da deneyebilmek icin
  const user = userEvent.setup({ applyAccept: false });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ReportScreen qrLocation={qrLocation} />
    </QueryClientProvider>,
  );
  return user;
}

function errorBody(code: string, message: string) {
  return { error: { code, message, details: {} } };
}

async function fillValidReport(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Ne oldu?"), "B blok 2. kat erkek tuvalette sabun bitmiş");
  await user.click(await screen.findByRole("button", { name: "B Blok 2. Kat Erkek WC" }));
}

const photo = () => new File(["png"], "sabun.png", { type: "image/png" });

const SLOW_START_MS = 5000;

describe("ReportScreen", () => {
  it("lists the campus locations to choose from", async () => {
    renderScreen();

    // Ilk test sahte API'yi ve bilesenleri ilk kez yukler; yavas CI'da varsayilan 1 sn yetmeyebiliyor
    const option = await screen.findByRole("button", { name: "B Blok 2. Kat Erkek WC" }, { timeout: SLOW_START_MS });
    expect(option).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "B201 Amfi" })).toBeInTheDocument();
  });

  it("finds a location by its nickname, ignoring Turkish letters and case", async () => {
    const user = renderScreen();
    await screen.findByRole("button", { name: "B201 Amfi" });

    await user.type(screen.getByLabelText("Konum"), "B2 WC");

    const results = screen.getByRole("list", { name: "Konum sonuçları" });
    expect(within(results).getAllByRole("button")).toHaveLength(1);
    expect(within(results).getByRole("button", { name: "B Blok 2. Kat Erkek WC" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Konum"));
    await user.type(screen.getByLabelText("Konum"), "kampus");
    expect(within(results).getByRole("button", { name: "Merkez Kampüs" })).toBeInTheDocument();
  });

  it("lists every location in a short scrolling box instead of hiding the rest", async () => {
    const many: LocationOption[] = Array.from({ length: 30 }, (_, index) => ({
      id: 900 + index,
      parent_id: null,
      kind: "ROOM",
      code: `D-${index + 1}`,
      name: `Deneme Konumu ${index + 1}`,
      path: `Deneme Konumu ${index + 1}`,
      aliases: [],
    }));
    server.use(http.get(apiUrl("/locations"), () => HttpResponse.json({ items: many, total: many.length, page: 1 })));
    renderScreen();

    const last = await screen.findByRole("button", { name: "Deneme Konumu 30" });

    const results = screen.getByRole("list", { name: "Konum sonuçları" });
    expect(within(results).getAllByRole("button")).toHaveLength(30);
    expect(results).toContainElement(last);
    expect(screen.getByText("30 konum · kaydırın ya da arayın")).toBeInTheDocument();
    expect(screen.queryByText(/daha var/)).not.toBeInTheDocument();
  });

  it("says so when no location matches", async () => {
    const user = renderScreen();
    await screen.findByRole("button", { name: "B201 Amfi" });

    await user.type(screen.getByLabelText("Konum"), "havuz");

    expect(screen.getByText("Eşleşen konum yok. Farklı bir kelime deneyin.")).toBeInTheDocument();
  });

  it("shows the chosen location and lets the reporter change it", async () => {
    const user = renderScreen();

    await user.click(await screen.findByRole("button", { name: "B201 Amfi" }));

    expect(screen.getByText("B201 Amfi")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Konum sonuçları" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Değiştir" }));

    expect(screen.getByLabelText("Konum")).toHaveValue("");
    expect(screen.getByRole("button", { name: "B Blok 2. Kat Erkek WC" })).toBeInTheDocument();
  });

  it("explains what is missing instead of sending", async () => {
    const user = renderScreen();

    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByText("Açıklama en az 10 karakter olmalı.")).toBeInTheDocument();
    expect(screen.getByText("Konum seçmelisiniz.")).toBeInTheDocument();
    expect(screen.getByLabelText("Ne oldu?")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Bildiriminiz alındı, inceleniyor")).not.toBeInTheDocument();
  });

  it("sends the report and shows the case number", async () => {
    const user = renderScreen();
    await fillValidReport(user);

    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByText("Bildiriminiz alındı, inceleniyor")).toBeInTheDocument();
    expect(screen.getByText(/^CASE-\d{6}$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bildirimlerim" })).toHaveAttribute("href", "/my-cases");
  });

  it("attaches a photo, lists it and sends it with the report", async () => {
    const user = renderScreen();
    await fillValidReport(user);

    await user.upload(screen.getByLabelText("Fotoğraf ya da video ekle"), photo());
    expect(screen.getByRole("listitem", { name: "sabun.png" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByText("Bildiriminiz alındı, inceleniyor")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("removes an attached file", async () => {
    const user = renderScreen();

    await user.upload(screen.getByLabelText("Fotoğraf ya da video ekle"), photo());
    await user.click(screen.getByRole("button", { name: "sabun.png dosyasını kaldır" }));

    expect(screen.queryByRole("listitem", { name: "sabun.png" })).not.toBeInTheDocument();
  });

  it("refuses an unsupported file before uploading it", async () => {
    const user = renderScreen();

    await user.upload(
      screen.getByLabelText("Fotoğraf ya da video ekle"),
      new File(["%PDF"], "rapor.pdf", { type: "application/pdf" }),
    );

    expect(screen.getByText("Yalnız JPG, PNG, WEBP fotoğraf ya da MP4, MOV video eklenebilir.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "rapor.pdf" })).not.toBeInTheDocument();
  });

  it("tells which file could not be uploaded after the report was created", async () => {
    server.use(
      http.post(apiUrl("/cases/:id/attachments"), () =>
        HttpResponse.json(errorBody("VIDEO_TOO_LONG", "Video 30 saniyeden uzun olamaz."), { status: 422 }),
      ),
    );
    const user = renderScreen();
    await fillValidReport(user);

    await user.upload(
      screen.getByLabelText("Fotoğraf ya da video ekle"),
      new File(["mp4"], "kopya.mp4", { type: "video/mp4" }),
    );
    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByText("Bildiriminiz alındı, inceleniyor")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("kopya.mp4");
    expect(alert).toHaveTextContent("Video 30 saniyeden uzun olamaz.");
  });

  it("keeps the form and shows the backend error when the report cannot be sent", async () => {
    server.use(
      http.post(apiUrl("/cases"), () =>
        HttpResponse.json(errorBody("INTERNAL", "Beklenmeyen bir hata oluştu."), { status: 500 }),
      ),
    );
    const user = renderScreen();
    await fillValidReport(user);

    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Beklenmeyen bir hata oluştu.");
    expect(screen.getByLabelText("Ne oldu?")).toHaveValue("B blok 2. kat erkek tuvalette sabun bitmiş");
  });

  // Telefonda kamera dogrudan acilsin; galeri secimi ayri kalir
  it("offers a camera shortcut that takes a photo straight into the report", async () => {
    const user = renderScreen();

    const camera = screen.getByLabelText("Fotoğraf çek");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).toHaveAttribute("accept", "image/*");

    await user.upload(camera, photo());

    expect(await screen.findByRole("button", { name: "sabun.png dosyasını kaldır" })).toBeInTheDocument();
  });

  // Liste yuklenince altindaki alanlar kaymasin (Lighthouse CLS): yuklenirken ayni yukseklikte yer tutulur
  it("keeps room for the location list while it loads", () => {
    renderScreen();

    const placeholder = screen.getByRole("list", { name: "Konumlar yükleniyor" });
    expect(placeholder).toHaveAttribute("aria-busy", "true");
    expect(within(placeholder).getAllByRole("listitem")).toHaveLength(LOCATION_VISIBLE_ROWS);
  });

  it("offers a retry when the locations cannot be loaded", async () => {
    server.use(
      http.get(
        apiUrl("/locations"),
        () => HttpResponse.json(errorBody("INTERNAL", "Beklenmeyen bir hata oluştu."), { status: 500 }),
        { once: true },
      ),
    );
    const user = renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Konumlar yüklenemedi.");
    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByRole("button", { name: "B201 Amfi" })).toBeInTheDocument();
  });

  it("starts a new, empty report from the confirmation", async () => {
    const user = renderScreen();
    await fillValidReport(user);
    await user.click(screen.getByRole("button", { name: "Gönder" }));
    await screen.findByText("Bildiriminiz alındı, inceleniyor");

    await user.click(screen.getByRole("button", { name: "Yeni bildirim yap" }));

    expect(screen.getByLabelText("Ne oldu?")).toHaveValue("");
  });

  describe("opened from a location QR code", () => {
    const QR_HINT = "QR koddan seçildi. Başka bir yerse Değiştir'e basın.";
    const NOT_FOUND = "QR koddaki konum bulunamadı ya da artık kullanılmıyor. Konumu aşağıdan arayın.";

    it("starts with the scanned location chosen and sends it", async () => {
      let sentLocation: unknown = null;
      server.use(
        http.post(apiUrl("/cases"), async ({ request }) => {
          sentLocation = ((await request.json()) as { location_id: number }).location_id;
          return HttpResponse.json({ id: 900, case_number: "CASE-000900", status: "ANALYZING" }, { status: 201 });
        }),
      );
      const user = renderScreen("4");

      expect(await screen.findByText(QR_HINT)).toBeInTheDocument();
      expect(screen.getByText("B Blok 2. Kat Erkek WC")).toBeInTheDocument();
      await user.type(screen.getByLabelText("Ne oldu?"), "Tuvalette sabun bitmiş, lütfen doldurun");
      await user.click(screen.getByRole("button", { name: "Gönder" }));

      await waitFor(() => expect(sentLocation).toBe(4));
    });

    it("lets the reporter pick another place", async () => {
      const user = renderScreen("4");

      await screen.findByText(QR_HINT);
      await user.click(screen.getByRole("button", { name: "Değiştir" }));

      expect(screen.getByLabelText("Konum")).toHaveValue("");
      expect(screen.queryByText(QR_HINT)).not.toBeInTheDocument();
    });

    it.each(["99", "abc"])("explains when the code %j points nowhere", async (code) => {
      renderScreen(code);

      expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: "B Blok 2. Kat Erkek WC" })).toBeInTheDocument();
    });
  });
});
