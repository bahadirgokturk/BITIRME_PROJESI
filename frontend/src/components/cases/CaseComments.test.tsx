import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";
import { USERS } from "@/mocks/fixtures";
import { resetComments } from "@/mocks/interactionHandlers";
import { server } from "@/mocks/node";
import { signInAs } from "@/mocks/session";

import { CaseComments } from "./CaseComments";

// Bildirenin kendi bildirimi (mocks/caseFixtures.ts)
const CASE_ID = 101;

function renderComments(user: (typeof USERS)[keyof typeof USERS] = USERS.REPORTER) {
  signInAs(user);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CaseComments caseId={CASE_ID} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const comments = () => within(screen.getByRole("list", { name: "Yorumlar" })).getAllByRole("listitem");
const box = () => screen.findByLabelText("Yorum yaz");

// Sahte oturum ve yorumlar modul icinde tutulur
afterEach(() => {
  signInAs(null);
  resetComments();
});

describe("CaseComments", () => {
  it("shows a skeleton, then says there is no comment yet", async () => {
    renderComments();

    expect(screen.getByRole("heading", { name: "Yorumlar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Yorumlar yükleniyor")).toBeInTheDocument();
    expect(await screen.findByText("Henüz yorum yok.")).toBeInTheDocument();
  });

  it("lets a reporter write a comment and shows it with name, role and time", async () => {
    const user = renderComments();

    const send = await screen.findByRole("button", { name: "Gönder" });
    expect(send).toBeDisabled();
    expect(screen.queryByLabelText(/İç not/)).not.toBeInTheDocument();
    await user.type(await box(), "Sabunluk hâlâ boş.");
    await user.click(send);

    expect(await screen.findByText("Sabunluk hâlâ boş.")).toBeInTheDocument();
    expect(comments()).toHaveLength(1);
    expect(comments()[0]).toHaveTextContent("Ayşe Yılmaz");
    expect(comments()[0]).toHaveTextContent("Bildirim yapan");
    expect(comments()[0]?.querySelector("time")).not.toBeNull();
    expect(await box()).toHaveValue("");
  });

  it("lets staff add an internal note, marked so and hidden from the reporter", async () => {
    const user = renderComments(USERS.STAFF);

    await user.type(await box(), "Depoda sabun kalmamış.");
    await user.click(screen.getByLabelText("İç not (bildirim yapan görmez)"));
    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByText("Depoda sabun kalmamış.")).toBeInTheDocument();
    expect(comments()[0]).toHaveTextContent("İç not");
    expect(comments()[0]).toHaveTextContent("Personel");
    expect(screen.getByLabelText("İç not (bildirim yapan görmez)")).not.toBeChecked();
  });

  it("shows comments to an admin without a form", async () => {
    renderComments(USERS.ADMIN);

    expect(await screen.findByText("Henüz yorum yok.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Yorum yaz")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gönder" })).not.toBeInTheDocument();
  });

  it("keeps the text and shows the reason when sending fails", async () => {
    server.use(
      http.post(apiUrl("/cases/:id/comments"), () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
      ),
    );
    const user = renderComments();

    await user.type(await box(), "Merhaba");
    await user.click(screen.getByRole("button", { name: "Gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Beklenmeyen bir hata oluştu.");
    expect(await box()).toHaveValue("Merhaba");
  });

  it("shows an error with a retry when the comments cannot be loaded", async () => {
    server.use(
      http.get(apiUrl("/cases/:id/comments"), () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
      ),
    );
    const user = renderComments();

    expect(await screen.findByText("Yorumlar yüklenemedi.")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));

    expect(await screen.findByText("Henüz yorum yok.")).toBeInTheDocument();
  });
});
