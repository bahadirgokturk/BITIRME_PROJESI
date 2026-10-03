import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { server } from "@/mocks/node";

import { ReportScreen } from "./ReportScreen";

function renderScreen() {
  // applyAccept kapali: input'un accept filtresini atlayip yanlis turdeki dosyayi da deneyebilmek icin
  const user = userEvent.setup({ applyAccept: false });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ReportScreen />
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
});
