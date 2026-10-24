import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { clearReportDrafts } from "@/hooks/useReportDraft";
import { createQueryClient } from "@/lib/queryClient";
import { reportDraftKey } from "@/lib/reportDraft";
import { USERS } from "@/mocks/fixtures";

import { ReportScreen } from "./ReportScreen";

const REPORTER = USERS.REPORTER;
const NOTICE = "Taslağınız geri yüklendi.";
const FILES_HINT = "Fotoğrafları yeniden eklemelisiniz.";
const DESCRIPTION = "B blok 2. kat erkek tuvalette sabun bitmiş";

// Kabuk /auth/me'yi zaten yukledigi icin form acilirken kullanici onbellekte hazirdir
function renderScreen(user = REPORTER, qrLocation?: string) {
  const client = createQueryClient();
  client.setQueryData(["auth", "me"], user);
  const view = render(
    <QueryClientProvider client={client}>
      <ReportScreen qrLocation={qrLocation} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), unmount: view.unmount };
}

function savedDraft() {
  return window.localStorage.getItem(reportDraftKey(REPORTER.id));
}

function saveDraft(draft: object, userId = REPORTER.id) {
  window.localStorage.setItem(reportDraftKey(userId), JSON.stringify(draft));
}

afterEach(() => {
  window.localStorage.clear();
});

describe("report draft", () => {
  it("keeps what the reporter wrote and brings it back next time", async () => {
    const first = renderScreen();
    await first.user.type(screen.getByLabelText("Ne oldu?"), DESCRIPTION);
    await first.user.click(
      await screen.findByRole("button", { name: "B Blok 2. Kat Erkek WC" }),
    );
    await waitFor(() => expect(savedDraft()).toContain("B blok 2. kat"));
    first.unmount();

    renderScreen();

    expect(screen.getByLabelText("Ne oldu?")).toHaveValue(DESCRIPTION);
    expect(
      await screen.findByText("B Blok 2. Kat Erkek WC"),
    ).toBeInTheDocument();
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(FILES_HINT)).not.toBeInTheDocument();
  });

  it("opens an empty form without a notice when there is no draft", () => {
    renderScreen();

    expect(screen.getByLabelText("Ne oldu?")).toHaveValue("");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("reminds that photos are not kept in the draft", () => {
    saveDraft({ description: DESCRIPTION, locationId: "", hadFiles: true });

    renderScreen();

    expect(screen.getByText(FILES_HINT)).toBeInTheDocument();
  });

  it("empties the form when the draft is deleted", async () => {
    saveDraft({ description: DESCRIPTION, locationId: "", hadFiles: false });
    const { user } = renderScreen();

    await user.click(screen.getByRole("button", { name: "Taslağı sil" }));

    expect(screen.getByLabelText("Ne oldu?")).toHaveValue("");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(savedDraft()).toBeNull();
  });

  it("forgets the draft once the report is sent", async () => {
    saveDraft({ description: DESCRIPTION, locationId: "", hadFiles: false });
    const { user } = renderScreen();

    await user.click(
      await screen.findByRole("button", { name: "B Blok 2. Kat Erkek WC" }),
    );
    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(
      await screen.findByRole("button", { name: "Yeni bildirim yap" }),
    ).toBeInTheDocument();
    expect(savedDraft()).toBeNull();
  });

  it("does not show another user's draft", () => {
    saveDraft(
      { description: DESCRIPTION, locationId: "", hadFiles: false },
      REPORTER.id + 1,
    );

    renderScreen();

    expect(screen.getByLabelText("Ne oldu?")).toHaveValue("");
  });
});

describe("clearReportDrafts", () => {
  it("removes every report draft on this device and nothing else", () => {
    saveDraft({ description: DESCRIPTION, locationId: "", hadFiles: false });
    saveDraft(
      { description: DESCRIPTION, locationId: "", hadFiles: false },
      REPORTER.id + 1,
    );
    window.localStorage.setItem("bakircayflow-theme", "dark");

    clearReportDrafts();

    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem("bakircayflow-theme")).toBe("dark");
  });

  // QR ile acilan form kapidaki yer icindir: taslaktaki eski konum yerine QR'in konumu (ya da bos arama) gelir
  it("keeps the draft text but not its old place when opened from a QR code", async () => {
    saveDraft({ description: DESCRIPTION, locationId: "5", hadFiles: false });
    renderScreen(REPORTER, "99999");

    expect(screen.getByLabelText("Ne oldu?")).toHaveValue(DESCRIPTION);
    expect(await screen.findByText(/QR koddaki konum bulunamadı/)).toBeInTheDocument();
    expect(screen.getByLabelText("Konum")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Değiştir" })).not.toBeInTheDocument();
  });

  // Taslakta yalniz konum varsa QR'li acilista geri gelen bir sey yoktur: "geri yuklendi" notu cikmaz
  it("does not announce a draft that held only a place when opened from a QR code", async () => {
    saveDraft({ description: "", locationId: "5", hadFiles: false });
    renderScreen(REPORTER, "4");

    expect(await screen.findByText(/QR koddan seçildi/)).toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});
